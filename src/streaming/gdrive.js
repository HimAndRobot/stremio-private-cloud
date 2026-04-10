const PLAYBACK_API_KEY = 'AIzaSyDVQw45DwoYh632gvsP5vPDqEKvb-Ywnb8';
const playbackCache = {};
const playbackPending = {};
const PLAYBACK_TTL = 3 * 60 * 60 * 1000;

// Get video playback URLs from Google Drive's streaming API
export async function getPlaybackUrl(fileId) {
  if (playbackCache[fileId] && Date.now() - playbackCache[fileId].time < PLAYBACK_TTL) {
    return playbackCache[fileId].url;
  }

  if (playbackPending[fileId]) return playbackPending[fileId];

  playbackPending[fileId] = (async () => {
    const apiUrl = `https://content-workspacevideo-pa.googleapis.com/v1/drive/media/${fileId}/playback?auditContext=forDisplay&key=${PLAYBACK_API_KEY}`;

    const res = await fetch(apiUrl, {
      headers: {
        'x-javascript-user-agent': 'google-api-javascript-client/1.1.0',
        'x-requested-with': 'XMLHttpRequest',
        'Referer': 'https://drive.google.com/',
      },
    });

    if (!res.ok) {
      console.log(`[GDrive] Playback API returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const parsed = JSON.parse(data.mediaStreamingData.serializedHouseBrandPlayerResponse);
    const formats = parsed.streamingData?.formats || [];

    if (!formats.length) return null;

    // Pick highest quality format
    const best = formats[formats.length - 1];
    playbackCache[fileId] = { url: best.url, time: Date.now() };
    return best.url;
  })().finally(() => { delete playbackPending[fileId]; });

  return playbackPending[fileId];
}

// Proxy stream from Google Drive shared files
export async function streamGdrive(req, res, file) {
  const meta = JSON.parse(file.source_meta || '{}');
  const driveFileId = meta.driveFileId;

  if (!driveFileId) {
    return res.status(400).json({ error: 'Missing Google Drive file ID' });
  }

  try {
    const videoUrl = await getPlaybackUrl(driveFileId);
    if (!videoUrl) {
      return res.status(403).json({ error: 'Could not get Google Drive playback URL' });
    }

    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const driveRes = await fetch(videoUrl, { headers, redirect: 'follow' });

    if (!driveRes.ok && driveRes.status !== 206) {
      driveRes.body?.cancel();
      // URL might be expired, clear cache and retry
      delete playbackCache[driveFileId];
      const freshUrl = await getPlaybackUrl(driveFileId);
      if (!freshUrl) {
        return res.status(403).json({ error: 'Google Drive playback URL expired' });
      }

      const retry = await fetch(freshUrl, { headers, redirect: 'follow' });
      if (!retry.ok && retry.status !== 206) {
        retry.body?.cancel();
        return res.status(502).json({ error: `Google Drive returned ${retry.status}` });
      }
      return pipeResponse(retry, res, file.mime_type);
    }

    return pipeResponse(driveRes, res, file.mime_type);
  } catch (err) {
    console.error('[GDrive] Error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: `Google Drive proxy failed: ${err.message}` });
    } else {
      res.end();
    }
  }
}

// Pipe a Google Drive response to the client
function pipeResponse(driveRes, res, mimeType) {
  const status = driveRes.status;
  const resHeaders = { 'Accept-Ranges': 'bytes' };

  const ct = driveRes.headers.get('content-type') || '';
  resHeaders['Content-Type'] = mimeType || ct;

  const cl = driveRes.headers.get('content-length');
  if (cl) resHeaders['Content-Length'] = cl;

  const cr = driveRes.headers.get('content-range');
  if (cr) resHeaders['Content-Range'] = cr;

  res.writeHead(status, resHeaders);

  const reader = driveRes.body.getReader();
  function pump() {
    reader.read().then(({ done, value }) => {
      if (done) { res.end(); return; }
      if (!res.writable) { reader.cancel(); return; }
      res.write(Buffer.from(value), () => pump());
    }).catch(() => res.end());
  }
  pump();
}

// Probe a Google Drive file to get its real size and filename
export async function probeDriveFile(fileId) {
  const videoUrl = await getPlaybackUrl(fileId);
  if (!videoUrl) {
    return { ok: false, error: 'Could not get playback URL' };
  }

  const res = await fetch(videoUrl, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' });

  if (!res.ok && res.status !== 206) {
    res.body?.cancel();
    return { ok: false, error: `Drive returned ${res.status}` };
  }

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
