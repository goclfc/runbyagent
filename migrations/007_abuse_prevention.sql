-- Anti-abuse measures

-- Rate limiting table (stores IP hashes, not raw IPs)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Add trusted flag to ratings (ratings from new visitors don't count initially)
ALTER TABLE variant_ratings ADD COLUMN IF NOT EXISTS trusted BOOLEAN NOT NULL DEFAULT TRUE;

-- Add IP hash tracking to picks for deduplication
CREATE TABLE IF NOT EXISTS variant_pick_ips (
  ip_hash TEXT NOT NULL,
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ip_hash, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_variant_pick_ips_hash ON variant_pick_ips(ip_hash, created_at DESC);

-- Add visitor creation tracking
CREATE TABLE IF NOT EXISTS visitor_metadata (
  visitor_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  page_views INTEGER NOT NULL DEFAULT 0
);
