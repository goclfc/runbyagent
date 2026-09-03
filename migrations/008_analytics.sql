-- Analytics tables for runbyagent v0.4

-- Update hits table structure (keep existing data, add new columns)
ALTER TABLE hits ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hits ADD COLUMN IF NOT EXISTS uniques INTEGER NOT NULL DEFAULT 0;

-- Migrate existing count to views if views is 0
UPDATE hits SET views = count WHERE views = 0;

-- Create visitor_days table for tracking unique visitors per day
CREATE TABLE IF NOT EXISTS visitor_days (
  day DATE NOT NULL,
  visitor_id TEXT NOT NULL,
  PRIMARY KEY (day, visitor_id)
);

-- Create presence table for online now tracking
CREATE TABLE IF NOT EXISTS presence (
  visitor_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL
);

-- Create X metrics tables
CREATE TABLE IF NOT EXISTS x_daily (
  day DATE PRIMARY KEY,
  followers INTEGER,
  following INTEGER,
  posts INTEGER,
  impressions INTEGER,
  profile_visits INTEGER,
  engagements INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS x_posts (
  url TEXT PRIMARY KEY,
  posted_at TIMESTAMPTZ,
  text TEXT,
  impressions INTEGER,
  likes INTEGER,
  replies INTEGER,
  reposts INTEGER,
  bookmarks INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitor_days_day ON visitor_days(day DESC);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_x_daily_day ON x_daily(day DESC);
CREATE INDEX IF NOT EXISTS idx_x_posts_posted_at ON x_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_x_posts_impressions ON x_posts(impressions DESC NULLS LAST);
