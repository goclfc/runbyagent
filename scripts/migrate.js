const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('No DATABASE_URL set, skipping migrations');
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
    console.log('Connected to database');

    // Create schema if not exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    console.log(`Schema ${schema} ready`);
    
    // Set search_path
    await client.query(`SET search_path TO ${schema}`);
    console.log(`search_path set to ${schema}`);
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        applied_at timestamptz DEFAULT now()
      )
    `);
    console.log('Migrations tracking table ready');

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      // Check if migration already applied
      const result = await client.query(
        'SELECT name FROM _migrations WHERE name = $1',
        [file]
      );
      
      if (result.rows.length > 0) {
        console.log(`Skipping migration (already applied): ${file}`);
        continue;
      }
      
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      
      // Record migration as applied
      await client.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [file]
      );
      console.log(`Completed migration: ${file}`);
    }

    console.log('All migrations completed');
    
    // Run changelog seeder after migrations
    if (fs.existsSync(path.join(__dirname, 'seed-changelog.js'))) {
      await client.end();
      console.log('Running changelog seed...');
      const { seedChangelog } = require('./seed-changelog.js');
      await seedChangelog();
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
