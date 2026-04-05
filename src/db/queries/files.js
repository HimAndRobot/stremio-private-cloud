import { getDb } from '../connection.js';

// Get file by ID
export function getFile(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

// Get all files for an IMDB ID (exact match for movies, prefix for series)
export function getFilesByImdb(imdbId) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE imdb_id = ?').all(imdbId);
}

// Get all files for a content item (all episodes of a series or movie files)
export function getFilesByContentImdb(imdbId) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE imdb_id LIKE ? ORDER BY imdb_id').all(`${imdbId}%`);
}

// Create a new file entry
export function createFile({ id, imdb_id, file_path, file_name, file_size, mime_type, quality, source_type }) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO files (id, imdb_id, file_path, file_name, file_size, mime_type, quality, source_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, imdb_id, file_path, file_name, file_size, mime_type, quality, source_type || 'local');
}

// Delete a file entry
export function deleteFile(id) {
  const db = getDb();
  return db.prepare('DELETE FROM files WHERE id = ?').run(id);
}

// Delete all files for an IMDB video ID
export function deleteFilesByImdb(imdbId) {
  const db = getDb();
  return db.prepare('DELETE FROM files WHERE imdb_id = ?').run(imdbId);
}

// List all files
export function listFiles() {
  const db = getDb();
  return db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
}
