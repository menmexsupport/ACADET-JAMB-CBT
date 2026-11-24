import { drizzle as drizzleNodePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.ts';

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  var _acadetPgPool: Pool | undefined;
  var _acadetPgSslActive: boolean | undefined;
  var _acadetPglite: PGlite | undefined;
  var _acadetDb: AppDatabase | undefined;
  var _acadetDbMode: 'render_postgres' | 'local_pglite' | undefined;
}

export function isRenderPostgresConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && url.length > 0);
}

export function getDatabaseMode(): 'render_postgres' | 'local_pglite' {
  if (!global._acadetDbMode) {
    global._acadetDbMode = isRenderPostgresConfigured() ? 'render_postgres' : 'local_pglite';
  }
  return global._acadetDbMode;
}

function shouldUseSslForUrl(url: string): boolean {
  const sslEnv = (process.env.DATABASE_SSL || 'auto').trim().toLowerCase();
  if (sslEnv === 'false' || sslEnv === '0' || sslEnv === 'disable') return false;
  if (sslEnv === 'true' || sslEnv === '1' || sslEnv === 'require') return true;
  // Auto-detect: external Render Postgres hostnames (*.render.com) or explicit sslmode require TLS;
  // internal Render hostnames (e.g. dpg-xxx-a) and localhost do not require SSL by default.
  const lower = url.toLowerCase();
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false;
  if (lower.includes('sslmode=require') || lower.includes('ssl=true') || lower.includes('.render.com')) {
    return true;
  }
  return false;
}

function createPgPool(useSsl: boolean): Pool {
  const url = process.env.DATABASE_URL!.trim();
  const pool = new Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: Number(process.env.PG_POOL_MAX || 15),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });
  pool.on('error', (err) => {
    console.error('[db] PostgreSQL pool idle error:', err);
  });
  global._acadetPgSslActive = useSsl;
  return pool;
}

export function getPgPool(): Pool {
  if (!global._acadetPgPool) {
    const url = process.env.DATABASE_URL!.trim();
    global._acadetPgPool = createPgPool(shouldUseSslForUrl(url));
  }
  return global._acadetPgPool;
}

async function initLocalPglite(): Promise<PGlite> {
  if (!global._acadetPglite) {
    const { PGlite: PGliteCtor } = await import('@electric-sql/pglite');
    const dataDir = path.resolve(process.cwd(), '.acadet-jamb-pgdata');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const stalePidFile = path.join(dataDir, 'postmaster.pid');
    if (fs.existsSync(stalePidFile)) {
      try {
        fs.unlinkSync(stalePidFile);
      } catch {
        // Ignore if not removable
      }
    }
    global._acadetPglite = new PGliteCtor(dataDir);
  }
  return global._acadetPglite;
}

async function initDbInstance(): Promise<AppDatabase> {
  if (isRenderPostgresConfigured()) {
    global._acadetDbMode = 'render_postgres';
    global._acadetDb = drizzleNodePg(getPgPool(), { schema });
  } else {
    const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
    global._acadetDbMode = 'local_pglite';
    const client = await initLocalPglite();
    global._acadetDb = drizzlePglite(client, { schema });
  }
  return global._acadetDb;
}

export function getDbSync(): AppDatabase {
  if (!global._acadetDb) {
    if (isRenderPostgresConfigured()) {
      global._acadetDbMode = 'render_postgres';
      global._acadetDb = drizzleNodePg(getPgPool(), { schema });
    } else {
      throw new Error('Local database not yet initialized. Ensure ensureDatabaseReady() completes before querying.');
    }
  }
  return global._acadetDb;
}

export async function executeRawSql(sqlText: string): Promise<void> {
  if (isRenderPostgresConfigured()) {
    const pool = getPgPool();
    await pool.query(sqlText);
  } else {
    const pglite = await initLocalPglite();
    await pglite.exec(sqlText);
  }
}

export async function ensureDatabaseReady(): Promise<void> {
  if (process.env.RENDER === 'true' && !isRenderPostgresConfigured()) {
    throw new Error(
      'DATABASE_URL environment variable is required when running on Render. Connect a Render PostgreSQL database and set DATABASE_URL.'
    );
  }

  if (isRenderPostgresConfigured()) {
    global._acadetDbMode = 'render_postgres';
    const maxAttempts = 6;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const pool = getPgPool();
        await pool.query('SELECT 1');
        global._acadetDb = drizzleNodePg(pool, { schema });
        db = global._acadetDb;
        return;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isSslMismatch =
          msg.includes('does not support SSL') ||
          msg.includes('SSL/TLS required') ||
          msg.includes('no pg_hba.conf entry') ||
          msg.includes('self-signed');
        if (isSslMismatch) {
          const nextSsl = !Boolean(global._acadetPgSslActive);
          console.warn(`[db] Retrying PostgreSQL connection with ssl=${nextSsl} after TLS mismatch: ${msg}`);
          try {
            await global._acadetPgPool?.end();
          } catch {
            // ignore
          }
          global._acadetPgPool = createPgPool(nextSsl);
          continue;
        }
        if (attempt < maxAttempts) {
          console.warn(
            `[db] Waiting for Render PostgreSQL (attempt ${attempt}/${maxAttempts}): ${msg}`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    throw lastError;
  }

  await initDbInstance();
  db = global._acadetDb!;
  const client = await initLocalPglite();
  try {
    await client.waitReady;
  } catch (err) {
    console.warn('[db] Local PGlite data directory could not recover cleanly; re-initializing preview DB...', err);
    const dataDir = path.resolve(process.cwd(), '.acadet-jamb-pgdata');
    try {
      await client.close();
    } catch {
      // ignore
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.mkdirSync(dataDir, { recursive: true });
    const { PGlite: PGliteCtor } = await import('@electric-sql/pglite');
    const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
    const fresh = new PGliteCtor(dataDir);
    await fresh.waitReady;
    global._acadetPglite = fresh;
    global._acadetDb = drizzlePglite(fresh, { schema });
    db = global._acadetDb;
  }
}

export async function closeDatabase(): Promise<void> {
  if (global._acadetPglite) {
    try {
      await global._acadetPglite.close();
    } catch {
      // ignore close errors
    }
    global._acadetPglite = undefined;
  }
  if (global._acadetPgPool) {
    try {
      await global._acadetPgPool.end();
    } catch {
      // ignore close errors
    }
    global._acadetPgPool = undefined;
  }
  global._acadetDb = undefined;
}

export let db: AppDatabase = isRenderPostgresConfigured()
  ? drizzleNodePg(getPgPool(), { schema })
  : (undefined as unknown as AppDatabase);
