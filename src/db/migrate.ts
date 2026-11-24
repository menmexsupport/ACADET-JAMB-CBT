import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ensureDatabaseReady, executeRawSql, getDatabaseMode } from './index.ts';

dotenv.config();

export async function runMigrations(): Promise<void> {
  await ensureDatabaseReady();
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sqlText = fs.readFileSync(sqlPath, 'utf-8');
    await executeRawSql(sqlText);
  }

  console.log(`[db:migrate] Applied ${files.length} migration(s) (${getDatabaseMode()}).`);
}

// Allow direct CLI execution via `npm run db:migrate` or `npm run db:migrate:prod`
const isDirectRun =
  process.argv[1]?.endsWith('migrate.ts') ||
  process.argv[1]?.endsWith('migrate.js') ||
  process.argv[1]?.endsWith('migrate.cjs');
if (isDirectRun) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db:migrate] Migration failed:', err);
      process.exit(1);
    });
}
