-- Houston Bush Intercontinental (IAH) wait times table
-- Run in Supabase SQL Editor (same project as JFK, Newark, LGA, and ATL)
-- 5 terminals: A, B, C, D, E

CREATE TABLE iah_wait_times (
  id            BIGSERIAL PRIMARY KEY,
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ta_general    SMALLINT,
  ta_precheck   SMALLINT,
  tb_general    SMALLINT,
  tb_precheck   SMALLINT,
  tc_general    SMALLINT,
  tc_precheck   SMALLINT,
  td_general    SMALLINT,
  td_precheck   SMALLINT,
  te_general    SMALLINT,
  te_precheck   SMALLINT
);

CREATE INDEX iah_wait_times_collected_at_idx ON iah_wait_times (collected_at DESC);

ALTER TABLE iah_wait_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON iah_wait_times FOR SELECT USING (true);
CREATE POLICY "Allow insert via service role" ON iah_wait_times FOR INSERT WITH CHECK (true);
