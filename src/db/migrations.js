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
      source_type TEXT DEFAULT 'local' CHECK(source_type IN ('local', 'gdrive', 'mega', 'telegram', 'url')),
      source_meta TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_files_imdb ON files(imdb_id);

    CREATE TABLE IF NOT EXISTS folders (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      parent_id   TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Add folder_id column to content if not present
  const contentCols = db.prepare("PRAGMA table_info(content)").all();
  if (!contentCols.find(c => c.name === 'folder_id')) {
    db.exec("ALTER TABLE content ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL");
  }

  // Migrate existing files table if CHECK constraint is outdated
  const hasOldConstraint = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='files'"
  ).get();

  if (hasOldConstraint?.sql && !hasOldConstraint.sql.includes('telegram')) {
    db.exec(`
      ALTER TABLE files RENAME TO files_old;

      CREATE TABLE files (
        id          TEXT PRIMARY KEY,
        imdb_id     TEXT NOT NULL,
        file_path   TEXT NOT NULL,
        file_name   TEXT NOT NULL,
        file_size   INTEGER,
        mime_type   TEXT,
        quality     TEXT,
        source_type TEXT DEFAULT 'local' CHECK(source_type IN ('local', 'gdrive', 'mega', 'telegram', 'url')),
        source_meta TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO files SELECT * FROM files_old;
      DROP TABLE files_old;

      CREATE INDEX IF NOT EXISTS idx_files_imdb ON files(imdb_id);
    `);
  }
}
