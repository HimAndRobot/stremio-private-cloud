import { getDb } from '../connection.js';

// List all content items with optional type filter and search
export function listContent({ type, search, skip = 0, limit = 100 } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM content WHERE 1=1';
  const values = [];

  if (type) {
    sql += ' AND type = ?';
    values.push(type);
  }
  if (search) {
    sql += ' AND name LIKE ?';
    values.push(`%${search}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  values.push(limit, skip);

  return db.prepare(sql).all(...values);
}

// Get a single content item by IMDB ID
export function getContent(imdbId) {
  const db = getDb();
  return db.prepare('SELECT * FROM content WHERE imdb_id = ?').get(imdbId);
}

// Create a new content item
export function createContent({ imdb_id, type, name, year, poster }) {
  const db = getDb();
  return db.prepare(
    'INSERT OR IGNORE INTO content (imdb_id, type, name, year, poster) VALUES (?, ?, ?, ?, ?)'
  ).run(imdb_id, type, name, year, poster);
}

// Delete a content item and all associated files
export function deleteContent(imdbId) {
  const db = getDb();
  db.prepare('DELETE FROM files WHERE imdb_id LIKE ?').run(`${imdbId}%`);
  return db.prepare('DELETE FROM content WHERE imdb_id = ?').run(imdbId);
}
