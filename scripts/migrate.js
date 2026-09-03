const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('No DATABASE_URL set, skipping migrations');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    console.log('Connected to database');

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`Completed migration: ${file}`);
    }

    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
