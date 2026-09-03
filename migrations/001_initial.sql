-- Initial schema for runbyagent

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  url TEXT,
  repo_url TEXT,
  idea_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('building', 'live', 'dead')) DEFAULT 'building',
  metrics_url TEXT,
  stripe_tag TEXT,
  screenshot_url TEXT,
  launched_at TIMESTAMPTZ,
  killed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_daily (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  cents INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('stripe', 'manual')) DEFAULT 'stripe',
  PRIMARY KEY (project_id, day, source)
);

CREATE TABLE IF NOT EXISTS project_metrics (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, key)
);

CREATE TABLE IF NOT EXISTS log_entries (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  x_url TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('prompt', 'decision', 'build', 'fix', 'post', 'delegate', 'ship', 'kill', 'numbers', 'note')) DEFAULT 'note',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hits (
  day DATE NOT NULL,
  path TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);

CREATE INDEX IF NOT EXISTS idx_revenue_daily_project_day ON revenue_daily(project_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_log_entries_created_at ON log_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_entries_project ON log_entries(project_id, created_at DESC);
