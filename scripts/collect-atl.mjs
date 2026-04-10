#!/usr/bin/env node
// Firecrawl → OpenAI → Supabase collection script for Atlanta Hartsfield-Jackson (ATL)
// Triggered by cron-job.org webhook hourly during the daytime
// Domestic checkpoints: Main, North, Lower North, South, PreCheck Only
// International checkpoint: Main
// NOTE: atl.com uses Cloudflare — if scraping fails, may need Firecrawl's stealth mode

function shouldCollect() {
  const etTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const et = new Date(etTime);
  const hour = et.getHours();
  const minute = et.getMinutes();
  if (hour >= 0 && hour < 5) return false;
  return minute === 0;
}

async function main() {
  if (!shouldCollect()) {
    console.log("Outside collection window — skipping.");
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
      url: "https://www.atl.com/times/",
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
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a data extraction assistant. Respond with ONLY a valid JSON object. No markdown, no backticks, no explanation. Just JSON. Use null for unknown values.",
        },
        {
          role: "user",
          content: `Extract Hartsfield-Jackson Atlanta International Airport (ATL) TSA security wait times. Return ONLY this JSON format:

{"Domestic_Main":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"Domestic_North":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"Domestic_Lower_North":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"Domestic_South":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"Domestic_PreCheck_Only":{"precheck":NUMBER_OR_NULL,"closed":BOOLEAN},"Intl_Main":{"general":NUMBER_OR_NULL,"precheck":NUMBER_OR_NULL,"closed":BOOLEAN}}

Rules:
- "general" = standard screening wait in minutes (integer)
- "precheck" = TSA PreCheck wait in minutes (integer)
- "closed" = true if checkpoint is closed
- Use null if unknown or not listed
- "No Wait" or "0" = 0
- Range like "15-30" = use higher number
- ATL domestic checkpoints: Main, North, Lower North, South, PreCheck Only (no standard lane)
- ATL international checkpoint: Main
- The PreCheck Only checkpoint has no general/standard lane

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
    domestic_main_general:        num(parsed.Domestic_Main?.general),
    domestic_main_precheck:       num(parsed.Domestic_Main?.precheck),
    domestic_north_general:       num(parsed.Domestic_North?.general),
    domestic_north_precheck:      num(parsed.Domestic_North?.precheck),
    domestic_lower_north_general: num(parsed.Domestic_Lower_North?.general),
    domestic_lower_north_precheck: num(parsed.Domestic_Lower_North?.precheck),
    domestic_south_general:       num(parsed.Domestic_South?.general),
    domestic_south_precheck:      num(parsed.Domestic_South?.precheck),
    domestic_precheck_only:       num(parsed.Domestic_PreCheck_Only?.precheck),
    intl_main_general:            num(parsed.Intl_Main?.general),
    intl_main_precheck:           num(parsed.Intl_Main?.precheck),
  };

  // Step 3: Supabase insert via REST API
  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/atl_wait_times`, {
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
