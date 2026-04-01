import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function getETDayRange(dateStr: string): { start: string; end: string } {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`);
  const etHourAtNoon = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hour12: false,
    }).format(noonUTC),
    10
  );
  const behindUTC = 12 - etHourAtNoon;

  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, behindUTC, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, behindUTC, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");

  let query = getSupabase()
    .from("atl_wait_times")
    .select("*")
    .order("collected_at", { ascending: true });

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const { start, end } = getETDayRange(dateParam);
    query = query.gte("collected_at", start).lt("collected_at", end);
  } else {
    const hours = Math.min(parseInt(searchParams.get("hours") || "24"), 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    query = query.gte("collected_at", since);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
