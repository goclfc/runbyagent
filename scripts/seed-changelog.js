const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

function parseChangelog() {
  const content = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
  const lines = content.split('\n');
  
  const entries = [];
  let currentDate = null;
  
  for (const line of lines) {
    // Check for date heading: ## 2026-09-03
    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }
    
    // Check for bullet point: - 13:30 text
    const entryMatch = line.match(/^- (\d{2}:\d{2}) (.+)$/);
    if (entryMatch && currentDate) {
      const [, time, text] = entryMatch;
      const timestamp = `${currentDate} ${time}:00+04`;
      
      // Determine kind from text
      let kind = 'note';
      let projectId = null;
      
      if (text.includes('gocha opens a session') || text.includes('gocha asks')) {
        kind = 'prompt';
      } else if (text.startsWith('decision:')) {
        kind = 'decision';
      } else if (text.includes('post goes out') || text.includes('posts on x')) {
        kind = 'post';
      } else if (text.includes('subagent') || text.includes('delegates') || text.includes('cursor') || text.includes('grok bot') || text.includes('cloud agent is launched')) {
        kind = 'delegate';
      } else if (text.includes('written') || text.includes('building') || text.includes('builds') || text.includes('api and pages') || text.includes('commit:') || text.includes('brief')) {
        kind = 'build';
      } else if (text.includes('fixed') || text.includes('fixes:')) {
        kind = 'fix';
      } else if (text.includes('chosen:') || text.includes('plan:')) {
        kind = 'decision';
      }
      
      // Check if related to painboard
      if (text.includes('painboard') || text.includes('ideaboard') || text.includes('the board')) {
        projectId = 'painboard';
      }
      
      entries.push({
        timestamp,
        text,
        kind,
        projectId
      });
    }
  }
  
  return entries;
}

async function seedChangelog() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('No DATABASE_URL set, skipping changelog seed');
    return;
  }
  
  const schema = process.env.DB_SCHEMA || 'public';
  
  // Validate schema name
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid DB_SCHEMA: ${schema}. Must match /^[a-z_][a-z0-9_]*$/`);
  }

  const client = new Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    
    // Set search_path
    await client.query(`SET search_path TO ${schema}`);
    console.log(`Connected to database for changelog seed (schema: ${schema})`);

    // Calculate hash of CHANGELOG.md
    const changelogPath = path.join(__dirname, '../CHANGELOG.md');
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    const hash = crypto.createHash('sha256').update(changelogContent).digest('hex');
    const migrationName = `seed-changelog:${hash}`;
    
    // Check if this version of the changelog has already been seeded
    const migrationCheck = await client.query(
      'SELECT name FROM _migrations WHERE name = $1',
      [migrationName]
    );
    
    if (migrationCheck.rows.length > 0) {
      console.log('Changelog already seeded (hash matches), skipping');
      return;
    }

    const entries = parseChangelog();
    console.log(`Parsed ${entries.length} changelog entries`);
    
    let inserted = 0;
    let skipped = 0;

    for (const entry of entries) {
      let projectId = null;
      
      // Get painboard project id if this entry is related to it
      if (entry.projectId === 'painboard') {
        const result = await client.query(
          'SELECT id FROM projects WHERE slug = $1',
          ['painboard']
        );
        if (result.rows.length > 0) {
          projectId = result.rows[0].id;
        }
      }
      
      // Check if entry already exists (dedupe by created_at and body)
      const existingEntry = await client.query(
        'SELECT id FROM log_entries WHERE created_at = $1 AND body = $2',
        [entry.timestamp, entry.text]
      );
      
      if (existingEntry.rows.length > 0) {
        skipped++;
        continue;
      }
      
      // Insert the entry
      await client.query(
        'INSERT INTO log_entries (body, kind, project_id, created_at) VALUES ($1, $2, $3, $4)',
        [entry.text, entry.kind, projectId, entry.timestamp]
      );
      inserted++;
    }

    // Record this version as seeded
    await client.query(
      'INSERT INTO _migrations (name) VALUES ($1)',
      [migrationName]
    );

    console.log(`Changelog seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
  } catch (error) {
    console.error('Changelog seed error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Only run if called directly
if (require.main === module) {
  seedChangelog();
}

module.exports = { seedChangelog };
