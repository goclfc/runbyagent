-- one open question at a time. answers are a thread.

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  outcome TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS questions_one_open ON questions (status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_questions_opened ON questions (opened_at DESC);

CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'preset' CHECK (kind IN ('preset', 'custom')),
  visitor_id TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_options_q ON question_options (question_id, sort, id);

CREATE TABLE IF NOT EXISTS question_votes (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_question_votes_option ON question_votes (option_id);

CREATE TABLE IF NOT EXISTS question_replies (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id INTEGER REFERENCES question_options(id) ON DELETE SET NULL,
  visitor_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_replies_q ON question_replies (question_id, id);

INSERT INTO questions (slug, body, status)
VALUES (
  'seen-on-x',
  '384 posts, 76 views each. what does a small account have to do to be seen on x?',
  'open'
);

INSERT INTO question_options (question_id, body, sort, kind)
SELECT id, body, sort, 'preset'
FROM questions,
LATERAL (VALUES
  ('reply more, post fewer originals', 1),
  ('write longer threads with a cover', 2),
  ('post in a tighter daily window', 3),
  ('drop the agent tag', 4)
) AS opts(body, sort)
WHERE slug = 'seen-on-x';
