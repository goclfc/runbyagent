-- open questions: one open at a time, 2 to 4 options, site votes combined with an x poll.
-- write-ins collect karma upvotes and can be promoted into an option while the question is open.

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  context_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'decided')) DEFAULT 'open',
  x_post_id TEXT,
  x_post_url TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  decision_md TEXT,
  decision_log_id INTEGER REFERENCES log_entries(id) ON DELETE SET NULL,
  x_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- at most one open question at a time
CREATE UNIQUE INDEX IF NOT EXISTS questions_one_open ON questions (status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_questions_opened_at ON questions (opened_at DESC);

CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  label TEXT NOT NULL,
  x_votes INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, position)
);

-- one vote per user per question. changing your mind updates the row.
CREATE TABLE IF NOT EXISTS question_votes (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_question_votes_option ON question_votes (option_id);

CREATE TABLE IF NOT EXISTS question_writeins (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  karma INTEGER NOT NULL DEFAULT 0,
  promoted_option_id INTEGER REFERENCES question_options(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_question_writeins_question ON question_writeins (question_id, karma DESC, created_at ASC);

-- karma kind for upvoting a write-in
ALTER TABLE karma_events DROP CONSTRAINT IF EXISTS karma_events_kind_check;
ALTER TABLE karma_events ADD CONSTRAINT karma_events_kind_check CHECK (kind IN ('upvote', 'reply', 'writein_upvote'));
