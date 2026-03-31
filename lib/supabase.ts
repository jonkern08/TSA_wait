import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type WaitTimeRow = {
  id: number;
  collected_at: string;
  t1_general: number | null;
  t1_precheck: number | null;
  t4_general: number | null;
  t4_precheck: number | null;
  t5_general: number | null;
  t5_precheck: number | null;
  t7_general: number | null;
  t7_precheck: number | null;
  t8_general: number | null;
  t8_precheck: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): SupabaseClient<any> {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}
