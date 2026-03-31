import { NextResponse } from "next/server";
import { fetchWaitTimes } from "@/lib/fetchWaitTimes";
import { getSupabase } from "@/lib/supabase";

// Protect this endpoint with a secret token
function isAuthorized(req: Request): boolean {
  const token = req.headers.get("x-collect-token");
  return token === process.env.COLLECT_SECRET;
}

// Returns true if we should collect given the current ET time.
// Between midnight–5am ET, only collect on :00 and :30 minutes.
function shouldCollect(): boolean {
  const etTime = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const et = new Date(etTime);
  const hour = et.getHours();
  const minute = et.getMinutes();

  const isOffPeak = hour >= 0 && hour < 5;
  if (!isOffPeak) return true;
  return minute === 0 || minute === 30;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!shouldCollect()) {
    return NextResponse.json({ skipped: true, reason: "off-peak, non-30min mark" });
  }

  const result = await fetchWaitTimes();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { data } = result;

  const { error } = await getSupabase().from("wait_times").insert({
    t1_general: data.T1.general,
    t1_precheck: data.T1.precheck,
    t4_general: data.T4.general,
    t4_precheck: data.T4.precheck,
    t5_general: data.T5.general,
    t5_precheck: data.T5.precheck,
    t7_general: data.T7.general,
    t7_precheck: data.T7.precheck,
    t8_general: data.T8.general,
    t8_precheck: data.T8.precheck,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
