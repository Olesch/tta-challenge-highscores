-- Admin-only note that someone has looked at a verified entry's Discord proof. Never shown publicly.
ALTER TABLE entries ADD COLUMN checked INTEGER NOT NULL DEFAULT 0;
