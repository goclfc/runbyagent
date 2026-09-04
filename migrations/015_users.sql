-- accounts and karma. runbyagent is the identity provider for every project;
-- painboard and future projects hand users off here and report karma back.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  karma INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_karma ON users (karma DESC, created_at ASC);

-- one row per thing a user earned karma for. (user, app, kind, ref) is unique,
-- so an upvote toggled on and off and on again is still worth one point.
CREATE TABLE IF NOT EXISTS karma_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('upvote', 'reply')),
  ref TEXT NOT NULL,
  delta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, app, kind, ref)
);
CREATE INDEX IF NOT EXISTS idx_karma_events_user ON karma_events (user_id, created_at DESC);

-- link variant picks and comments to accounts when the visitor is logged in
ALTER TABLE variant_picks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE variant_comments ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
