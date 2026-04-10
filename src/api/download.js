import { createWriteStream, statSync, existsSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { resolve } from 'path';
import { Readable } from 'stream';
import { File } from 'megajs';
import config from '../config.js';

// Active downloads progress tracking
const downloads = {};

// Get download progress
export function getDownloadProgress(downloadId) {
  return downloads[downloadId] || null;
}

// Download a file from an external source and save to uploads directory
export async function downloadToLocal(downloadId, sourceType, sourceMeta, fileName, totalSize, quality) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const savedPath = resolve(config.uploadDir, `${Date.now()}_${safeName}`);

  downloads[downloadId] = { progress: 0, total: 0, status: 'downloading', error: null };

  let written = 0;

  function updateProgress(chunk) {
    written += chunk.length;
    downloads[downloadId].progress = written;
  }

  try {
    let ws;
    if (sourceType !== 'youtube') {
      ws = createWriteStream(savedPath);
    }

    if (sourceType === 'gdrive') {
      const { driveFileId } = JSON.parse(sourceMeta);

      // Get uuid for direct download (full quality, full speed)
      const page = await fetch(`https://drive.google.com/uc?export=download&id=${driveFileId}`, { redirect: 'follow' });
      const html = await page.text();
      const uuid = html.match(/name="uuid" value="([^"]+)"/)?.[1];
      if (!uuid) throw new Error('Could not get Google Drive download token');

      const downloadUrl = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t&uuid=${uuid}`;
      const res = await fetch(downloadUrl, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) throw new Error('Google Drive blocked the download');

      const cl = res.headers.get('content-length');
      if (cl) downloads[downloadId].total = parseInt(cl, 10);

      const reader = res.body.getReader();
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const buf = Buffer.from(result.value);
          ws.write(buf);
          updateProgress(buf);
        }
      }
      ws.end();
      await new Promise((r, j) => { ws.on('finish', r); ws.on('error', j); });
    }

    else if (sourceType === 'mega') {
      const { megaUrl } = JSON.parse(sourceMeta);
      const file = File.fromURL(megaUrl);
      await file.loadAttributes();
      downloads[downloadId].total = Number(file.size || 0);

      const stream = file.download({ maxConnections: 4 });
      for await (const chunk of stream) {
        const buf = Buffer.from(chunk);
        ws.write(buf);
        updateProgress(buf);
      }
      ws.end();
      await new Promise((r, j) => { ws.on('finish', r); ws.on('error', j); });
    }

    else if (sourceType === 'telegram') {
      const { getClient, getMessageFile } = await import('../streaming/telegram.js');
      const { Api } = await import('telegram/tl/index.js');
      const c = await getClient();
      const { doc } = await getMessageFile(JSON.parse(sourceMeta).telegramUrl);

      downloads[downloadId].total = Number(doc.size || 0);

      const fileLocation = new Api.InputDocumentFileLocation({
        id: doc.id,
        accessHash: doc.accessHash,
        fileReference: doc.fileReference,
        thumbSize: '',
      });

      const iter = c.iterDownload({ file: fileLocation, requestSize: 1024 * 1024 });
      for await (const chunk of iter) {
        const buf = Buffer.from(chunk);
        ws.write(buf);
        updateProgress(buf);
      }
      ws.end();
      await new Promise((r, j) => { ws.on('finish', r); ws.on('error', j); });
    }

    else if (sourceType === 'youtube') {
      const { youtubeId } = JSON.parse(sourceMeta);

      await new Promise((resolve, reject) => {
        const height = quality ? parseInt(quality) : 1080;
        const proc = spawn('yt-dlp', ['-f', `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`, '--merge-output-format', 'mp4', '-o', savedPath, '--no-part', '--newline', `https://www.youtube.com/watch?v=${youtubeId}`]);
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`yt-dlp exited with ${code}`)));
        proc.on('error', reject);

        function parseProgress(data) {
          const line = data.toString();
          const pctMatch = line.match(/(\d+\.?\d*)%/);
          const totalMatch = line.match(/of\s+~?\s*(\d+\.?\d*)(MiB|GiB)/);
          if (totalMatch) {
            const mult = totalMatch[2] === 'GiB' ? 1073741824 : 1048576;
            downloads[downloadId].total = Math.round(parseFloat(totalMatch[1]) * mult);
          }
          if (pctMatch && downloads[downloadId].total) {
            downloads[downloadId].progress = Math.round(downloads[downloadId].total * parseFloat(pctMatch[1]) / 100);
          }
        }
        proc.stdout.on('data', parseProgress);
        proc.stderr.on('data', parseProgress);
      });
    }

    else {
      throw new Error(`Download not supported for: ${sourceType}`);
    }

    downloads[downloadId].status = 'done';
    return savedPath;
  } catch (err) {
    downloads[downloadId].status = 'error';
    downloads[downloadId].error = err.message;
    throw err;
  }
}
