import { drizzle as drizzleNodePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.ts';

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  var _acadetPgPool: Pool | undefined;
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

export async function executeRawSql(sqlText: string): Promise<void> {
  if (isRenderPostgresConfigured()) {
    const pool = getPgPool();
    await pool.query(sqlText);
  } else {
    const pglite = getPgliteClient();
    await pglite.exec(sqlText);
  }
}

export function getPgPool(): Pool {
  if (!global._acadetPgPool) {
    const url = process.env.DATABASE_URL!.trim();
    const useSsl = process.env.DATABASE_SSL !== 'false' && !url.includes('localhost') && !url.includes('127.0.0.1');
    global._acadetPgPool = new Pool({
      connectionString: url,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
    global._acadetPgPool.on('error', (err) => {
      console.error('PostgreSQL pool idle error:', err);
    });
  }
  return global._acadetPgPool;
}

export function getPgliteClient(): PGlite {
  if (!global._acadetPglite) {
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
    global._acadetPglite = new PGlite(dataDir);
  }
  return global._acadetPglite;
}

export function getDb(): AppDatabase {
  if (!global._acadetDb) {
    if (isRenderPostgresConfigured()) {
      global._acadetDbMode = 'render_postgres';
      global._acadetDb = drizzleNodePg(getPgPool(), { schema });
    } else {
      global._acadetDbMode = 'local_pglite';
      global._acadetDb = drizzlePglite(getPgliteClient(), { schema });
    }
  }
  return global._acadetDb;
}

export async function ensureDatabaseReady(): Promise<void> {
  if (isRenderPostgresConfigured()) {
    const pool = getPgPool();
    await pool.query('SELECT 1');
    return;
  }

  const client = getPgliteClient();
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
    const fresh = new PGlite(dataDir);
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
}

export let db: AppDatabase = getDb();
