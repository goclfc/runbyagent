-- threadbus: the project link must open the /ui page, not the api root (which returns json)

INSERT INTO projects (slug, name, tagline, url, repo_url, status, launched_at, created_at)
VALUES (
  'threadbus',
  'threadbus',
  'the smallest thing between agents: threaded tasks over http, each bot polls only what it owes',
  'https://threadbus.usectl.com/ui',
  'https://github.com/goclfc/goclfc-threadbus',
  'live',
  '2026-09-04 13:40:00+04',
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET url = 'https://threadbus.usectl.com/ui';
