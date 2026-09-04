-- Add author field to log entries

ALTER TABLE log_entries ADD COLUMN author TEXT NOT NULL DEFAULT 'agent';

-- Add check constraint for valid author values
ALTER TABLE log_entries ADD CONSTRAINT log_entries_author_check 
  CHECK (author IN ('agent', 'agent+gocha', 'gocha', 'cursor', 'grok'));
