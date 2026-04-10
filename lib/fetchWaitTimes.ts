const TERMINALS = ["T1", "T4", "T5", "T7", "T8"] as const;

type TerminalData = {
  general: number | null;
  precheck: number | null;
  closed: boolean;
};

export type WaitTimes = Record<(typeof TERMINALS)[number], TerminalData>;

export async function fetchWaitTimes(): Promise<
  | { success: true; data: WaitTimes; raw: string }
  | { success: false; error: string }
> {
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

  if (!scrapeRes.ok) {
    return { success: false, error: `Firecrawl HTTP ${scrapeRes.status}` };
  }

  const scrapeData = await scrapeRes.json();
  const rawText: string =
    scrapeData.data?.markdown || scrapeData.data?.content || "";

  if (!rawText || rawText.length < 20) {
    return { success: false, error: "Firecrawl returned no content" };
  }

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

  if (!extractRes.ok) {
    return { success: false, error: `OpenAI HTTP ${extractRes.status}` };
  }

  const extractData = await extractRes.json();
  const jsonText: string = (extractData.choices || [])
    .map((c: { message?: { content?: string } }) => c.message?.content || "")
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  let parsed: Record<string, TerminalData>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) {
      return { success: false, error: "Could not parse JSON from OpenAI response" };
    }
    parsed = JSON.parse(match[0]);
  }

  const data = {} as WaitTimes;
  for (const t of TERMINALS) {
    const d = parsed[t] || {};
    data[t] = {
      general: typeof d.general === "number" ? d.general : null,
      precheck: typeof d.precheck === "number" ? d.precheck : null,
      closed: !!d.closed,
    };
  }

  return { success: true, data, raw: rawText };
}
