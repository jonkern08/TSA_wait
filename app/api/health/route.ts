import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_AGE_MINUTES = 41;

const SOURCES = [
  { airport: "JFK", table: "wait_times" },
  { airport: "Newark", table: "newark_wait_times" },
  { airport: "LaGuardia", table: "lga_wait_times" },
] as const;

type HealthCheck = {
  airport: (typeof SOURCES)[number]["airport"];
  table: (typeof SOURCES)[number]["table"];
  latestCollectedAt: string | null;
  ageMinutes: number | null;
  ok: boolean;
  error?: string;
};

function getAgeMinutes(collectedAt: string): number {
  return Math.floor((Date.now() - new Date(collectedAt).getTime()) / 60000);
}

export async function GET() {
  const supabase = getSupabase();

  const checks = await Promise.all(
    SOURCES.map(async ({ airport, table }): Promise<HealthCheck> => {
      const { data, error } = await supabase
        .from(table)
        .select("collected_at")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          airport,
          table,
          latestCollectedAt: null,
          ageMinutes: null,
          ok: false,
          error: error.message,
        };
      }

      if (!data?.collected_at) {
        return {
          airport,
          table,
          latestCollectedAt: null,
          ageMinutes: null,
          ok: false,
          error: "No rows found",
        };
      }

      const ageMinutes = getAgeMinutes(data.collected_at);

      return {
        airport,
        table,
        latestCollectedAt: data.collected_at,
        ageMinutes,
        ok: ageMinutes <= MAX_AGE_MINUTES,
      };
    })
  );

  const ok = checks.every((check) => check.ok);

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      maxAgeMinutes: MAX_AGE_MINUTES,
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
