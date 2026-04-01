-- Atlanta Hartsfield-Jackson (ATL) wait times table
-- Run in Supabase SQL Editor (same project as JFK, Newark, LGA, IAH)
-- Domestic checkpoints: Main, North, Lower North, South, PreCheck Only
-- International checkpoint: Main

CREATE TABLE atl_wait_times (
  id                          BIGSERIAL PRIMARY KEY,
  collected_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  domestic_main_general       SMALLINT,
  domestic_main_precheck      SMALLINT,
  domestic_north_general      SMALLINT,
  domestic_north_precheck     SMALLINT,
  domestic_lower_north_general SMALLINT,
  domestic_lower_north_precheck SMALLINT,
  domestic_south_general      SMALLINT,
  domestic_south_precheck     SMALLINT,
  domestic_precheck_only      SMALLINT,
  intl_main_general           SMALLINT,
  intl_main_precheck          SMALLINT
);

CREATE INDEX atl_wait_times_collected_at_idx ON atl_wait_times (collected_at DESC);

ALTER TABLE atl_wait_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON atl_wait_times FOR SELECT USING (true);
CREATE POLICY "Allow insert via service role" ON atl_wait_times FOR INSERT WITH CHECK (true);
