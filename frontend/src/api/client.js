const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function searchCinemeta(query) {
  return request(`/content/search?q=${encodeURIComponent(query)}`);
}

export function getLibrary(type) {
  const params = type ? `?type=${type}` : '';
  return request(`/content${params}`);
}

export function getContent(imdbId) {
  return request(`/content/${imdbId}`);
}

export function addContent(imdbId, type) {
  return request('/content', {
    method: 'POST',
    body: JSON.stringify({ imdb_id: imdbId, type }),
  });
}

export function deleteContent(imdbId) {
  return request(`/content/${imdbId}`, { method: 'DELETE' });
}

export function deleteFile(fileId) {
  return request(`/files/${fileId}`, { method: 'DELETE' });
}

export function linkGdrive(imdbId, driveUrl, quality) {
  return request('/files/gdrive', {
    method: 'POST',
    body: JSON.stringify({ imdb_id: imdbId, drive_url: driveUrl, quality }),
  });
}

export async function uploadLocal(imdbId, file, quality) {
  const form = new FormData();
  form.append('video', file);
  form.append('imdb_id', imdbId);
  if (quality) form.append('quality', quality);

  const res = await fetch(`${BASE}/files/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}
