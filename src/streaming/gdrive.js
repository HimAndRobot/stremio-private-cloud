const uuidCache = {};
const uuidPending = {};
const UUID_TTL = 10 * 60 * 1000;

// Get a download UUID, deduplicating concurrent requests
async function getDownloadUuid(fileId) {
  if (uuidCache[fileId] && Date.now() - uuidCache[fileId].time < UUID_TTL) {
    return uuidCache[fileId].uuid;
  }

  if (uuidPending[fileId]) return uuidPending[fileId];

  uuidPending[fileId] = (async () => {
    const pageUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const page = await fetch(pageUrl, { redirect: 'follow' });
    const html = await page.text();
    const match = html.match(/name="uuid" value="([^"]+)"/);

    if (match) {
      uuidCache[fileId] = { uuid: match[1], time: Date.now() };
      return match[1];
    }
    return null;
  })().finally(() => { delete uuidPending[fileId]; });

  return uuidPending[fileId];
}

// Invalidate cached uuid
function invalidateUuid(fileId) {
  delete uuidCache[fileId];
}

// Build the download URL with uuid
function buildDownloadUrl(fileId, uuid) {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuid}`;
}

// Fetch from Google Drive with uuid, retry once on failure
async function fetchDrive(fileId, headers = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const uuid = await getDownloadUuid(fileId);
    if (!uuid) {
      console.log('[GDrive] Could not extract uuid');
      return null;
    }

    const url = buildDownloadUrl(fileId, uuid);
    const res = await fetch(url, { headers, redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';

    if ((res.ok || res.status === 206) && !ct.includes('text/html')) {
      return res;
    }

    console.log(`[GDrive] Retry ${attempt + 1}/2 | uuid=${uuid.slice(0,8)}... | range=${headers['Range'] || 'none'} | drive responded with HTML`);
    res.body?.cancel();
    invalidateUuid(fileId);
  }

  return null;
}

// Proxy stream from Google Drive shared files
export async function streamGdrive(req, res, file) {
  const meta = JSON.parse(file.source_meta || '{}');
  const driveFileId = meta.driveFileId;

  if (!driveFileId) {
    return res.status(400).json({ error: 'Missing Google Drive file ID' });
  }

  try {
    const CHUNK = 10 * 1024 * 1024;
    const total = file.file_size || 0;
    const headers = {};
    const reqRange = req.headers.range || '';

    let start = 0;
    let end = CHUNK - 1;

    if (reqRange) {
      const parts = reqRange.replace('bytes=', '').split('-');
      start = parseInt(parts[0], 10) || 0;
      end = parts[1] ? parseInt(parts[1], 10) : start + CHUNK - 1;
    }

    if (total && end >= total) end = total - 1;
    if (start > end) {
      return res.writeHead(416, { 'Content-Range': `bytes */${total}` }), res.end();
    }

    headers['Range'] = `bytes=${start}-${end}`;

    const driveRes = await fetchDrive(driveFileId, headers);

    if (!driveRes) {
      return res.status(403).json({
        error: 'Google Drive blocked the request. Check that the file is shared as "Anyone with the link".',
      });
    }

    const ct = driveRes.headers.get('content-type') || '';
    const status = driveRes.status;
    const resHeaders = { 'Accept-Ranges': 'bytes' };

    resHeaders['Content-Type'] = file.mime_type || ct;

    const cl = driveRes.headers.get('content-length');
    if (cl) resHeaders['Content-Length'] = cl;

    const cr = driveRes.headers.get('content-range');
    if (cr) resHeaders['Content-Range'] = cr;

    res.writeHead(status, resHeaders);

    const reader = driveRes.body.getReader();
    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) { res.end(); return; }
        res.write(Buffer.from(value), () => pump());
      }).catch(() => res.end());
    }
    pump();
  } catch (err) {
    console.error('[GDrive] Error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: `Google Drive proxy failed: ${err.message}` });
    } else {
      res.end();
    }
  }
}

// Probe a Google Drive file to get its real size and filename
export async function probeDriveFile(fileId) {
  const res = await fetchDrive(fileId, { Range: 'bytes=0-0' });

  if (!res) return { ok: false, error: 'File not accessible' };

  let fileSize = null;
  const cr = res.headers.get('content-range');
  if (cr) {
    const total = cr.split('/')[1];
    if (total && total !== '*') fileSize = parseInt(total, 10);
  }

  let fileName = null;
  const cd = res.headers.get('content-disposition');
  if (cd) {
    const match = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    if (match) fileName = decodeURIComponent(match[1].replace(/"/g, ''));
  }

  res.body?.cancel();
  return { ok: true, fileSize, fileName };
}

// Extract Google Drive file ID from various URL formats
export function parseDriveFileId(url) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;

  return null;
}
