-- Add author field to log entries

ALTER TABLE log_entries ADD COLUMN author TEXT NOT NULL DEFAULT 'agent';
