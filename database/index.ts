import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createInMemoryDatabase } from './inMemoryDb.ts';
import * as schema from './schema/index.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _inMemoryDbInstance: { db: any; pool: any } | undefined;
}

const hasDatabaseConfig = Boolean(process.env.SQL_HOST || process.env.DATABASE_URL);

export const createPool = () => {
  if (!hasDatabaseConfig) {
    if (!global._inMemoryDbInstance) {
      console.warn('[AI Studio] SQL_HOST/DATABASE_URL not configured — using in-memory database fallback');
      global._inMemoryDbInstance = createInMemoryDatabase(schema);
    }
    return global._inMemoryDbInstance.pool as Pool;
  }

  if (!global._postgresPool) {
    global._postgresPool = new Pool(
      process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            max: 10,
            connectionTimeoutMillis: 15000,
          }
        : {
            host: process.env.SQL_HOST,
            port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DB_NAME,
            max: 10,
            connectionTimeoutMillis: 15000,
          }
    );

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db: NodePgDatabase<typeof schema> = hasDatabaseConfig
  ? drizzle(pool, { schema })
  : (global._inMemoryDbInstance!.db as NodePgDatabase<typeof schema>);
export { pool };

export async function verifyDatabaseConnection(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = Date.now();
  await pool.query('SELECT 1 AS ok');
  return { ok: true, latencyMs: Date.now() - started };
}

export async function closeDatabasePool(): Promise<void> {
  if (global._postgresPool) {
    await global._postgresPool.end();
    global._postgresPool = undefined;
  }
}
