-- Houston Bush Intercontinental (IAH) wait times table
-- Run in Supabase SQL Editor (same project as JFK, Newark, LGA, ATL)
-- Active checkpoints: A North, A South, C North, E
-- No active B or D checkpoints

CREATE TABLE iah_wait_times (
  id                   BIGSERIAL PRIMARY KEY,
  collected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ta_north_general     SMALLINT,
  ta_north_precheck    SMALLINT,
  ta_south_general     SMALLINT,
  ta_south_precheck    SMALLINT,
  tc_north_general     SMALLINT,
  tc_north_precheck    SMALLINT,
  te_general           SMALLINT,
  te_precheck          SMALLINT
);

CREATE INDEX iah_wait_times_collected_at_idx ON iah_wait_times (collected_at DESC);

ALTER TABLE iah_wait_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON iah_wait_times FOR SELECT USING (true);
CREATE POLICY "Allow insert via service role" ON iah_wait_times FOR INSERT WITH CHECK (true);
