// Google Drive download URLs (tried in order)
function getDriveUrls(fileId) {
  return [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
  ];
}

// Resolve the actual download URL by following redirects and checking for HTML confirmation pages
async function resolveDownloadUrl(fileId) {
  const urls = getDriveUrls(fileId);

  for (const url of urls) {
    try {
      const probe = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { Range: 'bytes=0-0' },
      });

      const ct = probe.headers.get('content-type') || '';

      if (ct.includes('text/html')) {
        probe.body?.cancel();
        continue;
      }

      probe.body?.cancel();
      return { url: probe.url, ok: true };
    } catch {
      continue;
    }
  }

  return { url: urls[0], ok: false };
}

// Proxy stream from Google Drive shared files
export async function streamGdrive(req, res, file) {
  const meta = JSON.parse(file.source_meta || '{}');
  const driveFileId = meta.driveFileId;

  if (!driveFileId) {
    return res.status(400).json({ error: 'Missing Google Drive file ID' });
  }

  try {
    const { url: downloadUrl } = await resolveDownloadUrl(driveFileId);

    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const driveRes = await fetch(downloadUrl, { headers, redirect: 'follow' });

    if (!driveRes.ok && driveRes.status !== 206) {
      const ct = driveRes.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        driveRes.body?.cancel();
        return res.status(403).json({
          error: 'Google Drive returned an HTML page instead of the file. Make sure the file is shared as "Anyone with the link".',
        });
      }
      driveRes.body?.cancel();
      return res.status(502).json({ error: `Google Drive returned ${driveRes.status}` });
    }

    const ct = driveRes.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      driveRes.body?.cancel();
      return res.status(403).json({
        error: 'Google Drive requires confirmation for this file. Ensure the file sharing is set to "Anyone with the link".',
      });
    }

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
    res.status(502).json({ error: `Google Drive proxy failed: ${err.message}` });
  }
}

// Probe a Google Drive file to get its real size and filename
export async function probeDriveFile(fileId) {
  const { url: downloadUrl } = await resolveDownloadUrl(fileId);

  const probe = await fetch(downloadUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: { Range: 'bytes=0-0' },
  });

  const ct = probe.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    probe.body?.cancel();
    return { ok: false, error: 'File not accessible or requires confirmation' };
  }

  let fileSize = null;
  const cr = probe.headers.get('content-range');
  if (cr) {
    const total = cr.split('/')[1];
    if (total && total !== '*') fileSize = parseInt(total, 10);
  }

  let fileName = null;
  const cd = probe.headers.get('content-disposition');
  if (cd) {
    const match = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    if (match) fileName = decodeURIComponent(match[1].replace(/"/g, ''));
  }

  probe.body?.cancel();
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
