#!/usr/bin/env node
// Firecrawl → OpenAI → Supabase collection script
// Runs directly in GitHub Actions — no HTTP server needed

const TERMINALS = ["T1", "T4", "T5", "T7", "T8"];

function shouldCollect() {
  const etTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const et = new Date(etTime);
  const hour = et.getHours();
  const minute = et.getMinutes();
  const isOffPeak = hour >= 0 && hour < 5;
  if (!isOffPeak) return true;
  return minute === 0 || minute === 30;
}

async function main() {
  if (!shouldCollect()) {
    console.log("Off-peak, non-30min mark — skipping.");
    return;
  }

  // Step 1: Firecrawl scrape
  const scrapeRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: "https://www.jfkairport.com/",
      actions: [{ type: "wait", milliseconds: 3000 }],
    }),
  });

  if (!scrapeRes.ok) throw new Error(`Firecrawl HTTP ${scrapeRes.status}`);
  const scrapeData = await scrapeRes.json();
  const rawText = scrapeData.data?.markdown || scrapeData.data?.content || "";
  if (!rawText || rawText.length < 20) throw new Error("Firecrawl returned no content");

  // Step 2: OpenAI extraction
  const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are a data extraction assistant. Respond with ONLY a valid JSON object. No markdown, no backticks, no explanation. Just JSON. Use null for unknown values.",
        },
        {
          role: "user",
          content: `Extract JFK airport TSA security wait times. Return ONLY this JSON format:

{"T1":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"T4":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"T5":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"T7":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"T8":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN}}

Rules:
- "general" = standard screening wait in minutes (integer)
- "precheck" = TSA PreCheck wait in minutes (integer)
- "closed" = true if checkpoint is closed
- Use null if unknown
- "No Wait" or "0" = 0
- Range like "15-30" = use higher number
- Terminal 2 is permanently closed, do NOT include it

TEXT:
${rawText}`,
        },
      ],
    }),
  });

  if (!extractRes.ok) throw new Error(`OpenAI HTTP ${extractRes.status}`);
  const extractData = await extractRes.json();
  let jsonText = (extractData.choices || [])
    .map((c) => c.message?.content || "")
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse JSON from OpenAI response");
    parsed = JSON.parse(match[0]);
  }

  // Build flat row for Supabase
  const row = {};
  for (const t of TERMINALS) {
    const d = parsed[t] || {};
    const key = t.toLowerCase();
    row[`${key}_general`] = typeof d.general === "number" ? d.general : null;
    row[`${key}_precheck`] = typeof d.precheck === "number" ? d.precheck : null;
  }

  // Step 3: Supabase insert via REST API (no npm install needed)
  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/wait_times`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    throw new Error(`Supabase insert failed: ${err}`);
  }

  console.log("Collected:", JSON.stringify(parsed, null, 2));
}

main().catch((err) => {
  console.error("Collection failed:", err.message);
  process.exit(1);
});
