import { lookup } from 'mime-types';

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.m2ts'
]);

export function getMimeType(filename) {
  return lookup(filename) || 'application/octet-stream';
}

export function isVideoFile(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}
