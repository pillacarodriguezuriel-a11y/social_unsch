import { Pool } from 'pg';

let pool: Pool | null = null;

export function createFeedPool(databaseUrl: string): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}
