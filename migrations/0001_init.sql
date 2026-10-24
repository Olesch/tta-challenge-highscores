-- One row per submitted score. Challenges themselves live in data/challenges.json.
CREATE TABLE entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id  TEXT    NOT NULL,
  player        TEXT    NOT NULL,             -- name as typed (trimmed)
  player_key    TEXT    NOT NULL,             -- lowercase, used for grouping
  score         INTEGER NOT NULL,
  proof_url     TEXT,                         -- Discord message link; NULL = unverified
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source        TEXT    NOT NULL DEFAULT 'web', -- 'web' or 'sheet' (imported)
  ip_hash       TEXT,
  hidden        INTEGER NOT NULL DEFAULT 0,   -- set by an admin; hidden rows are not shown
  hidden_reason TEXT
);

CREATE INDEX entries_challenge ON entries (challenge_id, score DESC);
CREATE INDEX entries_player    ON entries (player_key);
CREATE INDEX entries_ip_time   ON entries (ip_hash, created_at);
