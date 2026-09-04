-- Redesign bot bus to thread-based conversations

-- Add task_messages table for threaded conversations
CREATE TABLE IF NOT EXISTS task_messages (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES bot_tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_messages_task_id ON task_messages(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_messages_created_at ON task_messages(created_at DESC);

-- Remove result columns from bot_tasks (replaced by messages)
ALTER TABLE bot_tasks DROP COLUMN IF EXISTS result;
ALTER TABLE bot_tasks DROP COLUMN IF EXISTS result_text;
