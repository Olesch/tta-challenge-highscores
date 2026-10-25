-- Entries obtained through a since-fixed game bug: still listed, but excluded from every ranking and sum.
ALTER TABLE entries ADD COLUMN bugged INTEGER NOT NULL DEFAULT 0;

-- Final Mix scores above 1000 came from the bug (the next highest legitimate score is under 200).
UPDATE entries SET bugged = 1 WHERE challenge_id = 'mix4_mix' AND score > 1000 AND source = 'sheet';
