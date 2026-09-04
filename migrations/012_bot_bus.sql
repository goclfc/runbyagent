-- Bot bus tables for runbyagent v0.5

-- Bots table for registered bots
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_created_at ON bots(created_at DESC);

-- Bot tasks for async task management
CREATE TABLE IF NOT EXISTS bot_tasks (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('research', 'publish', 'question')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'taken', 'done', 'failed')),
  result JSONB,
  result_text TEXT,
  created_by TEXT NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  taken_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bot_tasks_status ON bot_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_tasks_kind ON bot_tasks(kind, status, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_tasks_assigned_to ON bot_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
