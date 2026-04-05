import { getDb } from './connection.js';

// Run all database migrations
export function migrate() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS content (
      imdb_id     TEXT PRIMARY KEY,
      type        TEXT NOT NULL CHECK(type IN ('movie', 'series')),
      name        TEXT NOT NULL,
      year        TEXT,
      poster      TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS files (
      id          TEXT PRIMARY KEY,
      imdb_id     TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      file_name   TEXT NOT NULL,
      file_size   INTEGER,
      mime_type   TEXT,
      quality     TEXT,
      source_type TEXT DEFAULT 'local' CHECK(source_type IN ('local', 'gdrive', 'mega', 'url')),
      source_meta TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_files_imdb ON files(imdb_id);
  `);
}
