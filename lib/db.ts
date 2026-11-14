import { Pool } from 'pg';

const pgGlobal = globalThis as unknown as { pgPool?: Pool };

const pool = 
    pgGlobal.pgPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
    });

if (process.env.NODE_ENV !== 'production') {
    pgGlobal.pgPool = pool;
}

export default pool;
