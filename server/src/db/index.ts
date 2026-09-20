import { DatabaseSync } from 'node:sqlite';
import { getDb, closeDb, createDatabaseConnection } from './connection.js';
import { runMigrations, MigrationResult } from './migrator.js';
import { seedDatabase } from './seed.js';

export * from './connection.js';
export * from './migrator.js';
export * from './seed.js';

export function initializeDatabase(customDb?: DatabaseSync): {
  db: DatabaseSync;
  migrations: MigrationResult;
  seedResult: { seeded: boolean; counts: Record<string, number> };
} {
  const targetDb = customDb || getDb();
  const migrations = runMigrations(targetDb);
  const seedResult = seedDatabase(targetDb);

  return {
    db: targetDb,
    migrations,
    seedResult
  };
}
