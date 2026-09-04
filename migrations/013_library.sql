-- Library system for runbyagent v0.6

-- Extend research_docs for the library
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'research' CHECK (kind IN ('research', 'finding', 'article', 'setup'));
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS body_md TEXT;
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT 'agent';
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS sources JSONB;
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS related JSONB;
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- Version history for findings/articles/setup
CREATE TABLE IF NOT EXISTS library_versions (
  id SERIAL PRIMARY KEY,
  doc_id INTEGER NOT NULL REFERENCES research_docs(id) ON DELETE CASCADE,
  body_md TEXT,
  summary TEXT,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_docs_kind_published ON research_docs(kind, published, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_docs_slug ON research_docs(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_versions_doc_id ON library_versions(doc_id, created_at DESC);
