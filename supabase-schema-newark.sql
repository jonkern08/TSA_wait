-- Newark (EWR) wait times table
-- Run this in Supabase SQL Editor (same project as JFK)
-- NOTE: Terminal B has 3 separate security checkpoints (gates 40-49, 51-57, 60-68)

CREATE TABLE newark_wait_times (
  id BIGSERIAL PRIMARY KEY,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ta_general SMALLINT,
  ta_precheck SMALLINT,
  tb1_general SMALLINT,   -- Terminal B, Gates 40-49
  tb1_precheck SMALLINT,
  tb2_general SMALLINT,   -- Terminal B, Gates 51-57
  tb2_precheck SMALLINT,
  tb3_general SMALLINT,   -- Terminal B, Gates 60-68
  tb3_precheck SMALLINT,
  tc_general SMALLINT,
  tc_precheck SMALLINT
);

-- MIGRATION (run this if table already exists with old tb_general/tb_precheck columns):
-- ALTER TABLE newark_wait_times DROP COLUMN IF EXISTS tb_general;
-- ALTER TABLE newark_wait_times DROP COLUMN IF EXISTS tb_precheck;
-- ALTER TABLE newark_wait_times ADD COLUMN tb1_general SMALLINT;
-- ALTER TABLE newark_wait_times ADD COLUMN tb1_precheck SMALLINT;
-- ALTER TABLE newark_wait_times ADD COLUMN tb2_general SMALLINT;
-- ALTER TABLE newark_wait_times ADD COLUMN tb2_precheck SMALLINT;
-- ALTER TABLE newark_wait_times ADD COLUMN tb3_general SMALLINT;
-- ALTER TABLE newark_wait_times ADD COLUMN tb3_precheck SMALLINT;

CREATE INDEX newark_wait_times_collected_at_idx ON newark_wait_times (collected_at DESC);

ALTER TABLE newark_wait_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON newark_wait_times FOR SELECT USING (true);
CREATE POLICY "Allow insert via service role" ON newark_wait_times FOR INSERT WITH CHECK (true);
