import { File } from 'megajs';

// Proxy stream from MEGA shared files
export async function streamMega(req, res, file) {
  const meta = JSON.parse(file.source_meta || '{}');
  const megaUrl = meta.megaUrl;

  if (!megaUrl) {
    return res.status(400).json({ error: 'Missing MEGA URL' });
  }

  try {
    const megaFile = File.fromURL(megaUrl);
    await megaFile.loadAttributes();

    const total = megaFile.size;
    const mime = file.mime_type || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });

      const stream = megaFile.download({ start, end: end + 1, maxConnections: 1 });
      stream.on('error', () => res.end());
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
      });

      const stream = megaFile.download({ maxConnections: 1 });
      stream.on('error', () => res.end());
      stream.pipe(res);
    }
  } catch (err) {
    res.status(502).json({ error: `MEGA proxy failed: ${err.message}` });
  }
}

// Probe a MEGA file to get its name and size
export async function probeMegaFile(megaUrl) {
  const file = File.fromURL(megaUrl);
  await file.loadAttributes();
  return { ok: true, fileName: file.name, fileSize: file.size };
}

// Validate a MEGA URL format
export function parseMegaUrl(url) {
  const newFormat = /mega\.nz\/file\/([^#]+)#(.+)/;
  const oldFormat = /mega\.nz\/#!([^!]+)!(.+)/;

  if (newFormat.test(url) || oldFormat.test(url)) return url;
  return null;
}
