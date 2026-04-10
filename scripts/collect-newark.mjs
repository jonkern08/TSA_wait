#!/usr/bin/env node
// Firecrawl → OpenAI → Supabase collection script for Newark (EWR)
// Triggered by cron-job.org webhook on the schedule configured outside the repo
// Terminal B has 3 separate checkpoints: B1 (gates 40-49), B2 (51-57), B3 (60-68)

async function main() {
  // Step 1: Firecrawl scrape
  const scrapeRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: "https://www.newarkairport.com/",
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
          content: `Extract Newark Liberty International Airport (EWR) TSA security wait times. Return ONLY this JSON format:

{"A":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"B1":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"B2":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"B3":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"C":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN}}

Rules:
- "general" = standard screening wait in minutes (integer)
- "precheck" = TSA PreCheck wait in minutes (integer)
- "closed" = true if checkpoint is closed
- Use null if unknown
- "No Wait" or "0" = 0
- Range like "15-30" = use higher number
- Newark has 3 terminals: A, B, C
- Terminal B has 3 separate security checkpoints by gate range: B1 (gates 40-49), B2 (gates 51-57), B3 (gates 60-68)

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
    ta_general:   num(parsed.A?.general),
    ta_precheck:  num(parsed.A?.precheck),
    tb1_general:  num(parsed.B1?.general),
    tb1_precheck: num(parsed.B1?.precheck),
    tb2_general:  num(parsed.B2?.general),
    tb2_precheck: num(parsed.B2?.precheck),
    tb3_general:  num(parsed.B3?.general),
    tb3_precheck: num(parsed.B3?.precheck),
    tc_general:   num(parsed.C?.general),
    tc_precheck:  num(parsed.C?.precheck),
  };

  // Step 3: Supabase insert via REST API
  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/newark_wait_times`, {
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
