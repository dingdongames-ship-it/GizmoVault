import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  total: number;
}

export function runMigrations(db: DatabaseSync, customMigrationsDir?: string): MigrationResult {
  // 1. Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Fetch applied migrations
  const existingRows = db.prepare('SELECT name FROM _migrations ORDER BY id ASC').all() as Array<{ name: string }>;
  const appliedSet = new Set(existingRows.map((r) => r.name));

  // 3. Locate migrations folder
  const migrationsDir = customMigrationsDir || path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return { applied: [], skipped: [], total: 0 };
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) {
      skipped.push(file);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute migration within SQLite
    try {
      db.exec(sql);
      const insertStmt = db.prepare('INSERT INTO _migrations (name) VALUES (?)');
      insertStmt.run(file);
      applied.push(file);
    } catch (err: any) {
      console.error(`[Migrator Error] Failed executing ${file}:`, err.message);
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }

  return {
    applied,
    skipped,
    total: files.length
  };
}
