import { NextResponse } from "next/server";
import { fetchWaitTimes } from "@/lib/fetchWaitTimes";
import { getSupabase } from "@/lib/supabase";

// Protect this endpoint with a secret token
function isAuthorized(req: Request): boolean {
  const token = req.headers.get("x-collect-token");
  return token === process.env.COLLECT_SECRET;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
