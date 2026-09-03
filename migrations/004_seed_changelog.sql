-- Seed changelog entries from CHANGELOG.md
-- This migration is applied after the changelog constraint update
-- The actual seeding is done by a Node.js script: scripts/seed-changelog.js

-- Update the initial seed entry to use the correct timestamp and kind
UPDATE log_entries 
SET 
  created_at = '2026-09-03 15:30:00+04',
  kind = 'note'
WHERE body = 'runbyagent is live. project one is painboard.';
