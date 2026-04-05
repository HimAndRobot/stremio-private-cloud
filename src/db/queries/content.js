import { getDb } from '../connection.js';

// List content items in a folder (null = root), with optional type filter and search
export function listContent({ type, search, skip = 0, limit = 100, folder_id = undefined } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM content WHERE 1=1';
  const values = [];

  if (folder_id === null) {
    sql += ' AND folder_id IS NULL';
  } else if (folder_id) {
    sql += ' AND folder_id = ?';
    values.push(folder_id);
  }

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
export function createContent({ imdb_id, type, name, year, poster, folder_id }) {
  const db = getDb();
  return db.prepare(
    'INSERT OR IGNORE INTO content (imdb_id, type, name, year, poster, folder_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(imdb_id, type, name, year, poster, folder_id || null);
}

// Move content to a folder
export function moveContent(imdbId, folderId) {
  const db = getDb();
  db.prepare('UPDATE content SET folder_id = ? WHERE imdb_id = ?').run(folderId || null, imdbId);
}

// Delete a content item and all associated files
export function deleteContent(imdbId) {
  const db = getDb();
  db.prepare('DELETE FROM files WHERE imdb_id LIKE ?').run(`${imdbId}%`);
  return db.prepare('DELETE FROM content WHERE imdb_id = ?').run(imdbId);
}
