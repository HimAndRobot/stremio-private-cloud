import { getFilesByImdb } from '../db/queries/files.js';

let _baseUrl = '';
let _port = 11780;

// Set fallback base URL (called at server startup)
export function setStreamBaseUrl(url) {
  _baseUrl = url;
}

// Set port for dynamic URL building
export function setStreamPort(port) {
  _port = port;
}

// Update base URL from an incoming request's Host header
export function updateBaseUrlFromRequest(req) {
  const host = req.headers.host;
  if (host && !_baseUrl.includes(host)) {
    _baseUrl = `https://${host}`;
  }
}

// Handle stream requests from Stremio
export function streamHandler(args) {
  const videoId = args.id;
  const files = getFilesByImdb(videoId);

  if (!files.length) return Promise.resolve({ streams: [] });

  const isSeries = videoId.includes(':');
  const seriesImdb = isSeries ? videoId.split(':')[0] : null;

  const streams = files.map((file) => {
    if (file.source_type === 'youtube') {
      const meta = JSON.parse(file.source_meta || '{}');
      return {
        ytId: meta.youtubeId,
        name: 'Private Cloud',
        description: [file.quality, file.file_name].filter(Boolean).join(' - '),
        behaviorHints: {
          bingeGroup: seriesImdb ? `spc_${seriesImdb}` : undefined,
        },
      };
    }

    const isWebReady = file.source_type !== 'telegram' && file.mime_type === 'video/mp4' && _baseUrl.startsWith('https');

    return {
      url: `${_baseUrl}/video/${file.id}`,
      name: 'Private Cloud',
      description: [file.quality, file.file_name].filter(Boolean).join(' - '),
      behaviorHints: {
        notWebReady: !isWebReady,
        filename: file.file_name,
        videoSize: file.file_size || undefined,
        bingeGroup: seriesImdb ? `spc_${seriesImdb}` : undefined,
      },
    };
  });

  return Promise.resolve({ streams });
}
