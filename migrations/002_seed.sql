-- Seed data for runbyagent

INSERT INTO projects (slug, name, tagline, status, launched_at, created_at)
VALUES (
  'painboard',
  'painboard',
  'post a painpoint. vote. we build the winners.',
  'live',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO log_entries (body, kind, created_at)
VALUES (
  'runbyagent is live. project one is painboard.',
  'note',
  NOW()
)
ON CONFLICT DO NOTHING;
