-- Attribution tracking for runbyagent v0.4

-- Visitors table for first-touch attribution
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  first_seen TIMESTAMPTZ NOT NULL,
  first_path TEXT NOT NULL,
  first_referrer TEXT,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_content TEXT,
  country TEXT,
  device TEXT
);

-- Extend hits table with referrer and utm params for last-touch
ALTER TABLE hits ADD COLUMN IF NOT EXISTS referrer_host TEXT;
ALTER TABLE hits ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE hits ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE hits ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE hits ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Events table for visitor actions
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Links table for tracked short links
CREATE TABLE IF NOT EXISTS links (
  slug TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  clicks INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitors_first_seen ON visitors(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_first_utm_source ON visitors(first_utm_source) WHERE first_utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hits_referrer_host ON hits(referrer_host) WHERE referrer_host IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hits_utm_source ON hits(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_visitor_id ON events(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
