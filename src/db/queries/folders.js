import { getDb } from '../connection.js';

// List folders in a parent (null = root)
export function listFolders(parentId = null) {
  const db = getDb();
  if (parentId) {
    return db.prepare('SELECT * FROM folders WHERE parent_id = ? ORDER BY name').all(parentId);
  }
  return db.prepare('SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name').all();
}

// Get a folder by ID
export function getFolder(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
}

// Get folder path (breadcrumb)
export function getFolderPath(id) {
  const db = getDb();
  const path = [];
  let current = id;
  while (current) {
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(current);
    if (!folder) break;
    path.unshift(folder);
    current = folder.parent_id;
  }
  return path;
}

// Create a folder
export function createFolder({ id, name, parent_id }) {
  const db = getDb();
  db.prepare('INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)').run(id, name, parent_id || null);
  return getFolder(id);
}

// Rename a folder
export function renameFolder(id, name) {
  const db = getDb();
  db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id);
}

// Move a folder to another parent
export function moveFolder(id, newParentId) {
  const db = getDb();
  db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(newParentId || null, id);
}

// Delete a folder
export function deleteFolder(id) {
  const db = getDb();
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
}

// Get preview and stats for a folder
export function getFolderPreview(folderId) {
  const db = getDb();
  const contents = db.prepare(
    'SELECT poster FROM content WHERE folder_id = ? AND poster IS NOT NULL LIMIT 4'
  ).all(folderId);
  const subfolders = db.prepare(
    'SELECT id FROM folders WHERE parent_id = ? LIMIT ?'
  ).all(folderId, 4 - contents.length);

  const movieCount = db.prepare(
    "SELECT COUNT(*) as c FROM content WHERE folder_id = ? AND type = 'movie'"
  ).get(folderId).c;
  const seriesCount = db.prepare(
    "SELECT COUNT(*) as c FROM content WHERE folder_id = ? AND type = 'series'"
  ).get(folderId).c;
  const folderCount = db.prepare(
    'SELECT COUNT(*) as c FROM folders WHERE parent_id = ?'
  ).get(folderId).c;

  return {
    posters: contents.map(c => c.poster),
    subfolderCount: subfolders.length,
    stats: { movies: movieCount, series: seriesCount, folders: folderCount },
  };
}
