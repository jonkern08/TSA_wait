#!/usr/bin/env node
// Firecrawl → OpenAI → Supabase collection script for Houston Bush Intercontinental (IAH)
// Triggered by cron-job.org webhook every 20 minutes
// Active checkpoints: A North, A South, C North, E (no B or D checkpoints)

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
      url: "https://www.fly2houston.com/iah/security/",
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
          content: `Extract Houston Bush Intercontinental Airport (IAH) TSA security wait times. Return ONLY this JSON format:

{"A_North":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"A_South":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"C_North":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"E":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN}}

Rules:
- "general" = standard screening wait in minutes (integer)
- "precheck" = TSA PreCheck wait in minutes (integer)
- "closed" = true if checkpoint is closed
- Use null if unknown or not listed
- "No Wait" or "0" = 0
- Range like "15-30" = use higher number
- IAH active checkpoints: Terminal A North, Terminal A South, Terminal C North, Terminal E
- Checkpoint names appear as "IAH Terminal A North Standard", "IAH Terminal A South Standard", "IAH Terminal C North PreCheck", "IAH Terminal E", etc.

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
  const num = (v) => (typeof v === "number" ? v : null);
  const row = {
    ta_north_general:  num(parsed.A_North?.general),
    ta_north_precheck: num(parsed.A_North?.precheck),
    ta_south_general:  num(parsed.A_South?.general),
    ta_south_precheck: num(parsed.A_South?.precheck),
    tc_north_general:  num(parsed.C_North?.general),
    tc_north_precheck: num(parsed.C_North?.precheck),
    te_general:        num(parsed.E?.general),
    te_precheck:       num(parsed.E?.precheck),
  };

  // Step 3: Supabase insert via REST API
  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/iah_wait_times`, {
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
