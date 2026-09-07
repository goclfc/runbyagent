-- per-project counting. projects run on their own domains, so each one embeds /rba.js,
-- which beacons page views and a 30-second heartbeat with an anonymous id kept in that
-- project's localStorage. runbyagent's own pages feed the same tables as project 0, so
-- every number on the landing is computed one way.

CREATE TABLE IF NOT EXISTS project_hits (
  project_id INTEGER NOT NULL,            -- projects.id, or 0 for runbyagent itself
  vid TEXT NOT NULL,                      -- anonymous id from the project's localStorage
  day DATE NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  views INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (project_id, vid, day)
);

CREATE INDEX IF NOT EXISTS idx_project_hits_project_day ON project_hits (project_id, day);

CREATE TABLE IF NOT EXISTS project_presence (
  project_id INTEGER NOT NULL,
  vid TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, vid)
);

CREATE INDEX IF NOT EXISTS idx_project_presence_last_seen ON project_presence (last_seen);

-- both columns exist since 001; kept here so the migration reads as the whole change.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- the pill says live / building / killed. 'dead' stays valid for anything already stored.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('building', 'live', 'killed', 'dead'));

-- project 0 has history in visitor_days (one row per visitor per day). carry it over so
-- the platform's visitors and returning counts do not restart from zero. views are unknown
-- per day there, so each carried row counts as one view; platform views keep coming from hits.
INSERT INTO project_hits (project_id, vid, day, first_seen, last_seen, views)
SELECT 0, visitor_id, day, day::timestamptz, day::timestamptz, 1
FROM visitor_days
ON CONFLICT (project_id, vid, day) DO NOTHING;

-- card copy from the v0.9 spec, section 5. the seed taglines were written before the cards existed.
UPDATE projects SET tagline = 'People post the pains, vote on them, and a bot brings one a day.'
  WHERE slug = 'painboard';
UPDATE projects SET tagline = 'A message bus for agents: threads, whose turn it is, nothing you don''t owe.'
  WHERE slug = 'threadbus';
UPDATE projects SET tagline = 'A video studio an agent drives with curl. HTML in, MP4 out.'
  WHERE slug = 'animations';
UPDATE projects SET launched_at = '2026-09-04T00:00:00+04:00' WHERE slug IN ('painboard', 'threadbus') AND launched_at IS NULL;
UPDATE projects SET launched_at = '2026-09-07T19:44:00+04:00' WHERE slug = 'animations' AND launched_at IS NULL;
