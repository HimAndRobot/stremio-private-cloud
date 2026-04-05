import { getFilesByImdb } from '../db/queries/files.js';

let _baseUrl = '';

// Set the base URL used for stream URLs (called at server startup)
export function setStreamBaseUrl(url) {
  _baseUrl = url;
}

// Handle stream requests from Stremio
export function streamHandler(args) {
  const videoId = args.id;
  const files = getFilesByImdb(videoId);

  if (!files.length) return Promise.resolve({ streams: [] });

  const isSeries = videoId.includes(':');
  const seriesImdb = isSeries ? videoId.split(':')[0] : null;

  const streams = files.map((file) => {
    const isWebReady = file.mime_type === 'video/mp4' && _baseUrl.startsWith('https');

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
