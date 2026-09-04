-- optional cover image for library docs (a site-relative path such as /reports/cover.png, or an https url)
ALTER TABLE research_docs ADD COLUMN IF NOT EXISTS cover_url TEXT;
