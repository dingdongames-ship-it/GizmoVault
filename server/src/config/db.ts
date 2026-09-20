import { getDb, initializeDatabase as initUnifiedDb } from '../db/index.js';

export const db = getDb();

export function initializeDatabase() {
  return initUnifiedDb(db);
}
