import Database from 'better-sqlite3';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
import config from '../config.js';

let db;

// Initialize and return the SQLite database instance
export function getDb() {
  if (db) return db;

  mkdirSync(config.dataDir, { recursive: true });
  const dbPath = resolve(config.dataDir, 'library.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
