import { Router } from 'express';
import { streamLocal } from './local.js';
import { streamGdrive } from './gdrive.js';
import { getFile } from '../db/queries/files.js';

const router = Router();

// Serve video files with HTTP range request support
router.get('/video/:fileId', (req, res) => {
  const file = getFile(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  if (file.source_type === 'local') {
    return streamLocal(req, res, file);
  }

  if (file.source_type === 'gdrive') {
    return streamGdrive(req, res, file);
  }

  res.status(501).json({ error: `Source type '${file.source_type}' not yet supported` });
});

export default router;
