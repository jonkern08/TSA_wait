-- Run this in your Supabase project's SQL editor
-- (https://supabase.com/dashboard → your project → SQL Editor)

CREATE TABLE wait_times (
  id BIGSERIAL PRIMARY KEY,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  t1_general SMALLINT,
  t1_precheck SMALLINT,
  t4_general SMALLINT,
  t4_precheck SMALLINT,
  t5_general SMALLINT,
  t5_precheck SMALLINT,
  t7_general SMALLINT,
  t7_precheck SMALLINT,
  t8_general SMALLINT,
  t8_precheck SMALLINT
);

CREATE INDEX wait_times_collected_at_idx ON wait_times (collected_at DESC);

-- Allow read access for the frontend (via anon key if needed)
ALTER TABLE wait_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON wait_times FOR SELECT USING (true);
CREATE POLICY "Allow insert via service role" ON wait_times FOR INSERT WITH CHECK (true);
