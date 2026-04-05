import { Router } from 'express';
import { resolve, basename } from 'path';
import { renameSync, statSync } from 'fs';
import multer from 'multer';
import * as fileDb from '../db/queries/files.js';
import { fileId } from '../utils/id.js';
import { getMimeType, isVideoFile } from '../utils/mime.js';
import config from '../config.js';

const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

const router = Router();

// Upload a video file
router.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { imdb_id, quality } = req.body;
  if (!imdb_id) return res.status(400).json({ error: 'imdb_id is required' });

  const originalName = req.file.originalname;
  if (!isVideoFile(originalName)) {
    return res.status(400).json({ error: 'Not a recognized video file' });
  }

  const ext = originalName.slice(originalName.lastIndexOf('.'));
  const savedName = `${req.file.filename}${ext}`;
  const savedPath = resolve(config.uploadDir, savedName);

  renameSync(req.file.path, savedPath);

  const id = fileId();
  fileDb.createFile({
    id,
    imdb_id,
    file_path: savedPath,
    file_name: originalName,
    file_size: req.file.size,
    mime_type: getMimeType(originalName),
    quality: quality || null,
    source_type: 'local',
  });

  res.status(201).json(fileDb.getFile(id));
});

// Link a local file
router.post('/link', (req, res) => {
  const { imdb_id, file_path, quality } = req.body;
  if (!imdb_id || !file_path) {
    return res.status(400).json({ error: 'imdb_id and file_path are required' });
  }

  const fileName = basename(file_path);
  if (!isVideoFile(fileName)) {
    return res.status(400).json({ error: 'Not a recognized video file' });
  }

  let fileSize;
  try {
    fileSize = statSync(file_path).size;
  } catch {
    return res.status(400).json({ error: 'File not found at the specified path' });
  }

  const id = fileId();
  fileDb.createFile({
    id,
    imdb_id,
    file_path,
    file_name: fileName,
    file_size: fileSize,
    mime_type: getMimeType(fileName),
    quality: quality || null,
    source_type: 'local',
  });

  res.status(201).json(fileDb.getFile(id));
});

// Get files for an IMDB ID
router.get('/by-imdb/:imdbId', (req, res) => {
  res.json(fileDb.getFilesByContentImdb(req.params.imdbId));
});

// Delete a file
router.delete('/:id', (req, res) => {
  const file = fileDb.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });

  fileDb.deleteFile(req.params.id);
  res.json({ deleted: true });
});

export default router;
