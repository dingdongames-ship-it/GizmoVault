import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

export interface DatabaseConfig {
  dbPath?: string;
  inMemory?: boolean;
}

let activeDb: DatabaseSync | null = null;

export function getDatabasePath(): string {
  if (process.env.NODE_ENV === 'test' || process.env.DB_IN_MEMORY === 'true') {
    return ':memory:';
  }
  const dbDir = process.env.DB_DIR || path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, process.env.DB_NAME || 'gizmovault.db');
}

export function createDatabaseConnection(config?: DatabaseConfig): DatabaseSync {
  const targetPath = config?.inMemory 
    ? ':memory:' 
    : (config?.dbPath || getDatabasePath());

  const db = new DatabaseSync(targetPath);

  // Enable foreign keys, WAL mode, and busy timeout for high-concurrency production reliability
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  if (targetPath !== ':memory:') {
    try {
      db.exec(`PRAGMA journal_mode = WAL;`);
      db.exec(`PRAGMA synchronous = NORMAL;`);
    } catch {
      // WAL mode may fail on certain in-memory or read-only mounts
    }
  }

  return db;
}

export function getDb(): DatabaseSync {
  if (!activeDb) {
    activeDb = createDatabaseConnection();
  }
  return activeDb;
}

export function closeDb(): void {
  if (activeDb) {
    try {
      activeDb.close();
    } catch (err) {
      console.error('Error closing database:', err);
    }
    activeDb = null;
  }
}
