// Fetch metadata from Stremio Cinemeta API
export async function getMetadata(imdbId, type = 'series') {
  try {
    const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    if (data?.meta?.name) {
      return {
        imdb_id: imdbId,
        name: data.meta.name,
        year: data.meta.year || null,
        poster: data.meta.poster || null,
        type: data.meta.type || type,
        videos: data.meta.videos || [],
      };
    }

    throw new Error(`No metadata found for ${imdbId}`);
  } catch (error) {
    if (type === 'series') {
      try {
        return await getMetadata(imdbId, 'movie');
      } catch {
        // fall through
      }
    }

    return {
      imdb_id: imdbId,
      name: imdbId,
      year: null,
      poster: null,
      type,
      videos: [],
    };
  }
}

// Search Cinemeta catalog
export async function searchCinemeta(query, type = 'movie') {
  const url = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  return (data?.metas || []).map((m) => ({
    imdb_id: m.id,
    name: m.name,
    year: m.year || m.releaseInfo || null,
    poster: m.poster || null,
    type: m.type || type,
  }));
}
