import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    
    const schema = process.env.DB_SCHEMA || 'public';
    
    // Validate schema name
    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
      throw new Error(`Invalid DB_SCHEMA: ${schema}. Must match /^[a-z_][a-z0-9_]*$/`);
    }
    
    pool = new Pool({ connectionString: databaseUrl });
    
    // Set search_path for each connection
    pool.on('connect', async (client) => {
      await client.query(`SET search_path TO ${schema}`);
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows;
}
