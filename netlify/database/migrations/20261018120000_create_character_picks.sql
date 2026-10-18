-- Characters that can be picked. Only ids listed here are counted, so random
-- requests can't invent new characters. Add new characters with a NEW migration
-- file (never edit this one after it has been deployed).
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per character per day (UTC). Counting per day lets popularity be
-- measured over a recent window, so the paid selection can rotate over time.
CREATE TABLE character_daily_picks (
  character_id TEXT NOT NULL REFERENCES characters (id),
  day DATE NOT NULL,
  picks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, day)
);

INSERT INTO characters (id, name) VALUES
  ('grandma', 'Grandma'),
  ('boss', 'Boss'),
  ('soldier', 'Soldier'),
  ('bodybuilder', 'Bodybuilder');
