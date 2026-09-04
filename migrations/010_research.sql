-- Research inbox for runbyagent v0.5

CREATE TABLE IF NOT EXISTS research_docs (
  id SERIAL PRIMARY KEY,
  name TEXT,
  lines JSONB NOT NULL,
  meta JSONB,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_docs_created_at ON research_docs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_docs_source ON research_docs(source) WHERE source IS NOT NULL;
