import { createReadStream, statSync } from 'fs';
import { getMimeType } from '../utils/mime.js';

// Stream a local file with HTTP range request support
export function streamLocal(req, res, file) {
  let stat;
  try {
    stat = statSync(file.file_path);
  } catch {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const fileSize = stat.size;
  const mime = file.mime_type || getMimeType(file.file_name);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mime,
    });

    createReadStream(file.file_path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
    });

    createReadStream(file.file_path).pipe(res);
  }
}
