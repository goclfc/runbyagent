-- Update log_entries to support new kinds and changelog entries

-- Drop the old constraint
ALTER TABLE log_entries DROP CONSTRAINT IF EXISTS log_entries_kind_check;

-- Add the new constraint with all kinds
ALTER TABLE log_entries ADD CONSTRAINT log_entries_kind_check 
  CHECK (kind IN ('prompt', 'decision', 'build', 'fix', 'post', 'delegate', 'ship', 'kill', 'numbers', 'note'));
