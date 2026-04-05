import { Router } from 'express';
import { resolve, basename } from 'path';
import { renameSync, statSync } from 'fs';
import multer from 'multer';
import * as fileDb from '../db/queries/files.js';
import { fileId } from '../utils/id.js';
import { getMimeType, isVideoFile } from '../utils/mime.js';
import { parseDriveFileId, probeDriveFile } from '../streaming/gdrive.js';
import { parseMegaUrl, probeMegaFile } from '../streaming/mega.js';
import { parseTelegramLink, getMessageFile } from '../streaming/telegram.js';
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

// Link a Google Drive shared file
router.post('/gdrive', async (req, res) => {
  const { imdb_id, drive_url, quality, file_name } = req.body;
  if (!imdb_id || !drive_url) {
    return res.status(400).json({ error: 'imdb_id and drive_url are required' });
  }

  const driveFileId = parseDriveFileId(drive_url);
  if (!driveFileId) {
    return res.status(400).json({ error: 'Could not extract Google Drive file ID from URL' });
  }

  // Probe the file to verify it's accessible, get size and real filename
  let fileSize = null;
  let detectedName = file_name || null;
  try {
    const probe = await probeDriveFile(driveFileId);
    if (!probe.ok) {
      return res.status(400).json({ error: 'Google Drive file not accessible. Make sure the file is shared as "Anyone with the link".' });
    }
    fileSize = probe.fileSize;
    if (!detectedName && probe.fileName) detectedName = probe.fileName;
  } catch {
    // Probe failed, continue anyway — streaming might still work
  }

  if (!detectedName) detectedName = `gdrive_${driveFileId}.mp4`;

  const id = fileId();
  fileDb.createFile({
    id,
    imdb_id,
    file_path: drive_url,
    file_name: detectedName,
    file_size: fileSize,
    mime_type: getMimeType(detectedName),
    quality: quality || null,
    source_type: 'gdrive',
    source_meta: JSON.stringify({ driveFileId }),
  });

  res.status(201).json(fileDb.getFile(id));
});

// Link a MEGA shared file
router.post('/mega', async (req, res) => {
  const { imdb_id, mega_url, quality } = req.body;
  if (!imdb_id || !mega_url) {
    return res.status(400).json({ error: 'imdb_id and mega_url are required' });
  }

  const validUrl = parseMegaUrl(mega_url);
  if (!validUrl) {
    return res.status(400).json({ error: 'Invalid MEGA URL format' });
  }

  let fileSize = null;
  let detectedName = null;
  try {
    const probe = await probeMegaFile(validUrl);
    if (!probe.ok) {
      return res.status(400).json({ error: 'MEGA file not accessible' });
    }
    fileSize = probe.fileSize;
    detectedName = probe.fileName;
  } catch (err) {
    return res.status(400).json({ error: `Failed to access MEGA file: ${err.message}` });
  }

  if (!detectedName) detectedName = `mega_file.mp4`;

  const id = fileId();
  fileDb.createFile({
    id,
    imdb_id,
    file_path: mega_url,
    file_name: detectedName,
    file_size: fileSize,
    mime_type: getMimeType(detectedName),
    quality: quality || null,
    source_type: 'mega',
    source_meta: JSON.stringify({ megaUrl: validUrl }),
  });

  res.status(201).json(fileDb.getFile(id));
});

// Link a Telegram file
router.post('/telegram', async (req, res) => {
  const { imdb_id, telegram_url, quality } = req.body;
  if (!imdb_id || !telegram_url) {
    return res.status(400).json({ error: 'imdb_id and telegram_url are required' });
  }

  const parsed = parseTelegramLink(telegram_url);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid Telegram message link' });
  }

  let fileName = null;
  let fileSize = null;
  try {
    const info = await getMessageFile(telegram_url);
    fileName = info.fileName;
    fileSize = info.fileSize;
  } catch (err) {
    return res.status(400).json({ error: `Failed to access Telegram file: ${err.message}` });
  }

  if (!fileName) fileName = 'telegram_file.mp4';

  const id = fileId();
  fileDb.createFile({
    id,
    imdb_id,
    file_path: telegram_url,
    file_name: fileName,
    file_size: fileSize,
    mime_type: getMimeType(fileName),
    quality: quality || null,
    source_type: 'telegram',
    source_meta: JSON.stringify({ telegramUrl: telegram_url }),
  });

  res.status(201).json(fileDb.getFile(id));
});

// Get files for an IMDB ID
router.get('/by-imdb/:imdbId', (req, res) => {
  res.json(fileDb.getFilesByContentImdb(req.params.imdbId));
});

// Rename a file
router.put('/:id', (req, res) => {
  const file = fileDb.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });

  const { file_name } = req.body;
  if (!file_name?.trim()) return res.status(400).json({ error: 'file_name is required' });

  fileDb.updateFileName(req.params.id, file_name.trim());
  res.json(fileDb.getFile(req.params.id));
});

// Delete a file
router.delete('/:id', (req, res) => {
  const file = fileDb.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });

  fileDb.deleteFile(req.params.id);
  res.json({ deleted: true });
});

export default router;
