import { getDb } from './connection.js';

const migrations = [
  {
    version: 1,
    description: 'Initial schema',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS content (
          imdb_id     TEXT PRIMARY KEY,
          type        TEXT NOT NULL CHECK(type IN ('movie', 'series')),
          name        TEXT NOT NULL,
          year        TEXT,
          poster      TEXT,
          folder_id   TEXT,
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
          source_type TEXT DEFAULT 'local',
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
    },
  },
  {
    version: 2,
    description: 'Add folder_id to content',
    up(db) {
      const cols = db.prepare("PRAGMA table_info(content)").all();
      if (!cols.find(c => c.name === 'folder_id')) {
        db.exec("ALTER TABLE content ADD COLUMN folder_id TEXT");
      }
    },
  },
  {
    version: 3,
    description: 'Add upload source type',
    up(db) {
      const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='files'").get();
      if (info?.sql?.includes('CHECK')) {
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
            source_type TEXT DEFAULT 'local',
            source_meta TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO files SELECT * FROM files_old;
          DROP TABLE files_old;
          CREATE INDEX IF NOT EXISTS idx_files_imdb ON files(imdb_id);
        `);
      }
    },
  },
  {
    version: 4,
    description: 'Remove CHECK constraint from files.source_type',
    up(db) {
      const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='files'").get();
      if (info?.sql?.includes('CHECK')) {
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
            source_type TEXT DEFAULT 'local',
            source_meta TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO files SELECT * FROM files_old;
          DROP TABLE files_old;
          CREATE INDEX IF NOT EXISTS idx_files_imdb ON files(imdb_id);
        `);
      }
    },
  },
];

// Run all pending migrations
export function migrate() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT,
      applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = db.prepare('SELECT version FROM _migrations ORDER BY version').all()
    .map(r => r.version);

  for (const m of migrations) {
    if (applied.includes(m.version)) continue;

    console.log(`[Migration] Running v${m.version}: ${m.description}`);
    db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(m.version, m.description);
    })();
  }
}
