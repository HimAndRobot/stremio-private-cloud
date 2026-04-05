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

export function getLibrary(type, folderId) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (folderId) params.set('folder_id', folderId);
  else params.set('folder_id', 'root');
  const qs = params.toString();
  return request(`/content${qs ? '?' + qs : ''}`);
}

export function getContent(imdbId) {
  return request(`/content/${imdbId}`);
}

export function addContent(imdbId, type, folderId) {
  return request('/content', {
    method: 'POST',
    body: JSON.stringify({ imdb_id: imdbId, type, folder_id: folderId || undefined }),
  });
}

// Folders
export function getFolders(parentId) {
  const qs = parentId ? `?parent_id=${parentId}` : '';
  return request(`/folders${qs}`);
}

export function getFolderPath(folderId) {
  return request(`/folders/path/${folderId}`);
}

export function createFolder(name, parentId) {
  return request('/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parent_id: parentId || undefined }),
  });
}

export function renameFolder(folderId, name) {
  return request(`/folders/${folderId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function deleteFolder(folderId) {
  return request(`/folders/${folderId}`, { method: 'DELETE' });
}

export function moveContentToFolder(imdbId, folderId) {
  return request('/folders/move-content', {
    method: 'POST',
    body: JSON.stringify({ imdb_id: imdbId, folder_id: folderId || null }),
  });
}

export function moveFolderToFolder(folderId, parentId) {
  return request(`/folders/${folderId}/move`, {
    method: 'POST',
    body: JSON.stringify({ parent_id: parentId || null }),
  });
}

export function deleteContent(imdbId) {
  return request(`/content/${imdbId}`, { method: 'DELETE' });
}

export function renameFile(fileId, fileName) {
  return request(`/files/${fileId}`, {
    method: 'PUT',
    body: JSON.stringify({ file_name: fileName }),
  });
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

export function linkMega(imdbId, megaUrl, quality) {
  return request('/files/mega', {
    method: 'POST',
    body: JSON.stringify({ imdb_id: imdbId, mega_url: megaUrl, quality }),
  });
}

export function resetAllData() {
  return request('/settings/reset', { method: 'DELETE' });
}

export function getIntegrations() {
  return request('/settings/integrations');
}

export function saveTelegram(apiId, apiHash) {
  return request('/settings/integrations/telegram', {
    method: 'POST',
    body: JSON.stringify({ api_id: apiId, api_hash: apiHash }),
  });
}

export function removeTelegram() {
  return request('/settings/integrations/telegram', { method: 'DELETE' });
}

export function telegramSendCode(phone) {
  return request('/settings/integrations/telegram/send-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export function telegramVerifyCode(phone, code, phoneCodeHash) {
  return request('/settings/integrations/telegram/verify-code', {
    method: 'POST',
    body: JSON.stringify({ phone, code, phoneCodeHash }),
  });
}

export function telegramLogout() {
  return request('/settings/integrations/telegram/logout', { method: 'POST' });
}

export function linkTelegram(imdbId, telegramUrl, quality) {
  return request('/files/telegram', {
    method: 'POST',
    body: JSON.stringify({ imdb_id: imdbId, telegram_url: telegramUrl, quality }),
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
