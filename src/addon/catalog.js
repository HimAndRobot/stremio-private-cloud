import { listContent } from '../db/queries/content.js';

// Handle catalog requests from Stremio
export function catalogHandler(args) {
  const typeMap = { 'spc-movies': 'movie', 'spc-series': 'series' };
  const type = typeMap[args.id] || args.type;
  const search = args.extra?.search;
  const skip = parseInt(args.extra?.skip || '0', 10);

  const items = listContent({ type, search, skip, limit: 100 });

  const metas = items.map((item) => ({
    id: item.imdb_id,
    type: item.type,
    name: item.name,
    poster: item.poster || undefined,
    releaseInfo: item.year || undefined,
  }));

  return Promise.resolve({ metas });
}
