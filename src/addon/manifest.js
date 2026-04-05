// Stremio addon manifest definition
export function buildManifest() {
  return {
    id: 'community.stremio-private-cloud',
    name: 'Private Cloud',
    version: '1.0.0',
    description: 'Your personal media library on Stremio',
    resources: [
      'catalog',
      {
        name: 'stream',
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
      },
    ],
    types: ['movie', 'series'],
    catalogs: [
      {
        id: 'spc-movies',
        type: 'movie',
        name: 'Private Cloud - Movies',
        extra: [
          { name: 'search', isRequired: false },
          { name: 'skip', isRequired: false },
        ],
      },
      {
        id: 'spc-series',
        type: 'series',
        name: 'Private Cloud - Series',
        extra: [
          { name: 'search', isRequired: false },
          { name: 'skip', isRequired: false },
        ],
      },
    ],
    idPrefixes: ['tt'],
    behaviorHints: {
      configurable: false,
    },
  };
}
