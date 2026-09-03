-- Variants gallery tables

CREATE TABLE IF NOT EXISTS variants (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  file TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS variant_ratings (
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (variant_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS variant_picks (
  visitor_id TEXT PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS variant_comments (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variant_ratings_variant ON variant_ratings(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_picks_variant ON variant_picks(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_comments_variant ON variant_comments(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_variant_comments_visitor ON variant_comments(visitor_id, created_at DESC);
