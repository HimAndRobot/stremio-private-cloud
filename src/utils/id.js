import { v4 as uuidv4 } from 'uuid';

// Generate a short ID (8 chars from UUID)
function shortId() {
  return uuidv4().replace(/-/g, '').slice(0, 8);
}

export function movieId() {
  return `spc_movie_${shortId()}`;
}

export function seriesId() {
  return `spc_series_${shortId()}`;
}

export function episodeVideoId(seriesId, season, episode) {
  return `${seriesId}:${season}:${episode}`;
}

export function fileId() {
  return uuidv4();
}
