import { Router } from 'express';
import * as contentDb from '../db/queries/content.js';
import { getFilesByContentImdb } from '../db/queries/files.js';
import { getMetadata, searchCinemeta } from './cinemeta.js';

const router = Router();

// Search Cinemeta for movies/series
router.get('/search', async (req, res) => {
  const { q, type = 'movie' } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const [movies, series] = await Promise.all([
    searchCinemeta(q, 'movie'),
    searchCinemeta(q, 'series'),
  ]);

  res.json([...movies, ...series]);
});

// List library content
router.get('/', (req, res) => {
  const { type, search, skip, folder_id } = req.query;
  const fid = folder_id === 'root' ? null : folder_id;
  const items = contentDb.listContent({ type, search, skip: parseInt(skip || '0', 10), folder_id: fid });
  res.json(items);
});

// Get content detail with files
router.get('/:imdbId', async (req, res) => {
  const content = contentDb.getContent(req.params.imdbId);
  if (!content) return res.status(404).json({ error: 'Not found' });

  const files = getFilesByContentImdb(req.params.imdbId);
  let meta = null;

  try {
    meta = await getMetadata(req.params.imdbId, content.type);
  } catch {
    // metadata fetch failed, continue without it
  }

  res.json({ ...content, files, meta });
});

// Add content to library (from Cinemeta search result)
router.post('/', async (req, res) => {
  const { imdb_id, type, folder_id } = req.body;
  if (!imdb_id) return res.status(400).json({ error: 'imdb_id is required' });

  const existing = contentDb.getContent(imdb_id);
  if (existing) return res.status(409).json({ error: 'Already in library', content: existing });

  const meta = await getMetadata(imdb_id, type || 'movie');
  contentDb.createContent({
    imdb_id: meta.imdb_id,
    type: meta.type,
    name: meta.name,
    year: meta.year,
    poster: meta.poster,
    folder_id: folder_id || null,
  });

  res.status(201).json(contentDb.getContent(imdb_id));
});

// Delete content and all files
router.delete('/:imdbId', (req, res) => {
  const content = contentDb.getContent(req.params.imdbId);
  if (!content) return res.status(404).json({ error: 'Not found' });

  contentDb.deleteContent(req.params.imdbId);
  res.json({ deleted: true });
});

export default router;
