-- Atlanta Hartsfield-Jackson (ATL) wait times table
-- Run in Supabase SQL Editor (same project as JFK, Newark, and LGA)
-- Checkpoints: North (concourses A-D), South (concourses E-F), International Terminal

CREATE TABLE atl_wait_times (
  id              BIGSERIAL PRIMARY KEY,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  north_general   SMALLINT,
  north_precheck  SMALLINT,
  south_general   SMALLINT,
  south_precheck  SMALLINT,
  intl_general    SMALLINT,
  intl_precheck   SMALLINT
);

CREATE INDEX atl_wait_times_collected_at_idx ON atl_wait_times (collected_at DESC);

ALTER TABLE atl_wait_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON atl_wait_times FOR SELECT USING (true);
CREATE POLICY "Allow insert via service role" ON atl_wait_times FOR INSERT WITH CHECK (true);
