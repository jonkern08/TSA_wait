-- Newark (EWR) wait times table
-- Run this in Supabase SQL Editor (same project as JFK)

CREATE TABLE newark_wait_times (
  id BIGSERIAL PRIMARY KEY,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ta_general SMALLINT,
  ta_precheck SMALLINT,
  tb_general SMALLINT,
  tb_precheck SMALLINT,
  tc_general SMALLINT,
  tc_precheck SMALLINT
);

CREATE INDEX newark_wait_times_collected_at_idx ON newark_wait_times (collected_at DESC);

ALTER TABLE newark_wait_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON newark_wait_times FOR SELECT USING (true);
CREATE POLICY "Allow insert via service role" ON newark_wait_times FOR INSERT WITH CHECK (true);
