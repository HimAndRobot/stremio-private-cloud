import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as folderDb from '../db/queries/folders.js';
import { moveContent } from '../db/queries/content.js';

const router = Router();

// List folders in a parent
router.get('/', (req, res) => {
  const { parent_id } = req.query;
  const folders = folderDb.listFolders(parent_id || null);
  const withPreviews = folders.map((f) => ({
    ...f,
    preview: folderDb.getFolderPreview(f.id),
  }));
  res.json(withPreviews);
});

// Get folder path (breadcrumb)
router.get('/path/:id', (req, res) => {
  res.json(folderDb.getFolderPath(req.params.id));
});

// Create folder
router.post('/', (req, res) => {
  const { name, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = uuidv4();
  const folder = folderDb.createFolder({ id, name, parent_id });
  res.status(201).json({ ...folder, preview: { posters: [], subfolderCount: 0 } });
});

// Rename folder
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  folderDb.renameFolder(req.params.id, name);
  res.json(folderDb.getFolder(req.params.id));
});

// Move folder
router.post('/:id/move', (req, res) => {
  const { parent_id } = req.body;
  folderDb.moveFolder(req.params.id, parent_id);
  res.json({ moved: true });
});

// Move content to folder
router.post('/move-content', (req, res) => {
  const { imdb_id, folder_id } = req.body;
  if (!imdb_id) return res.status(400).json({ error: 'imdb_id is required' });

  moveContent(imdb_id, folder_id || null);
  res.json({ moved: true });
});

// Delete folder
router.delete('/:id', (req, res) => {
  const folder = folderDb.getFolder(req.params.id);
  if (!folder) return res.status(404).json({ error: 'Not found' });

  folderDb.deleteFolder(req.params.id);
  res.json({ deleted: true });
});

export default router;
