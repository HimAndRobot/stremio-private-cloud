import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import bigInt from 'big-integer';
import { getSetting, setSetting } from '../api/settings.js';

let client = null;

// Get or create Telegram client
async function getClient() {
  if (client?.connected) return client;

  const apiId = parseInt(getSetting('telegram_api_id'), 10);
  const apiHash = getSetting('telegram_api_hash');
  const sessionStr = getSetting('telegram_session') || '';

  if (!apiId || !apiHash) throw new Error('Telegram not configured');

  const session = new StringSession(sessionStr);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  return client;
}

// Start login: send code to phone
export async function sendCode(phone) {
  const apiId = parseInt(getSetting('telegram_api_id'), 10);
  const apiHash = getSetting('telegram_api_hash');

  if (!apiId || !apiHash) throw new Error('Telegram not configured');

  const session = new StringSession('');
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  const result = await client.sendCode({ apiId, apiHash }, phone);
  return result.phoneCodeHash;
}

// Complete login: verify code
export async function verifyCode(phone, code, phoneCodeHash) {
  if (!client) throw new Error('Call sendCode first');

  await client.invoke(
    new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code })
  );

  const sessionStr = client.session.save();
  setSetting('telegram_session', sessionStr);
  return true;
}

// Logout and clear session
export async function logout() {
  if (client) {
    await client.disconnect();
    client = null;
  }
  setSetting('telegram_session', '');
}

// Parse t.me message link
export function parseTelegramLink(url) {
  const privateMatch = url.match(/t\.me\/c\/(\d+)\/(?:(\d+)\/)?(\d+)/);
  if (privateMatch) {
    return {
      channelId: bigInt(`-100${privateMatch[1]}`),
      messageId: parseInt(privateMatch[3], 10),
    };
  }

  const publicMatch = url.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
  if (publicMatch) {
    return {
      username: publicMatch[1],
      messageId: parseInt(publicMatch[2], 10),
    };
  }

  return null;
}

// Get message and document from a Telegram link
async function resolveMessage(telegramUrl) {
  const parsed = parseTelegramLink(telegramUrl);
  if (!parsed) throw new Error('Invalid Telegram link');

  const c = await getClient();

  let peer;
  if (parsed.channelId) {
    peer = await c.getEntity(parsed.channelId);
  } else {
    peer = await c.getEntity(parsed.username);
  }

  const messages = await c.getMessages(peer, { ids: [parsed.messageId] });
  const message = messages?.[0];
  if (!message?.media) throw new Error('Message has no media');

  const doc = message.media.document;
  if (!doc) throw new Error('Message has no document');

  return { client: c, message, doc };
}

// Get file info from a Telegram message
export async function getMessageFile(telegramUrl) {
  const { doc } = await resolveMessage(telegramUrl);
  const fileName = doc.attributes?.find((a) => a.fileName)?.fileName || 'telegram_file.mp4';
  const fileSize = Number(doc.size || 0);
  return { fileName, fileSize };
}

// Stream a Telegram file to HTTP response
export async function streamTelegram(req, res, file) {
  const meta = JSON.parse(file.source_meta || '{}');
  const telegramUrl = meta.telegramUrl;

  if (!telegramUrl) {
    return res.status(400).json({ error: 'Missing Telegram URL' });
  }

  try {
    const { client: c, doc } = await resolveMessage(telegramUrl);

    const total = file.file_size || Number(doc.size || 0);
    const mime = file.mime_type || 'video/mp4';
    const range = req.headers.range;
    const REQUEST_SIZE = 1024 * 1024;

    const fileLocation = new Api.InputDocumentFileLocation({
      id: doc.id,
      accessHash: doc.accessHash,
      fileReference: doc.fileReference,
      thumbSize: '',
    });

    if (range && total > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 2 * 1024 * 1024 - 1, total - 1);
      const length = end - start + 1;

      console.log(`[Telegram] Range: ${start}-${end}/${total}`);

      // Align offset down to REQUEST_SIZE boundary
      const alignedStart = Math.floor(start / REQUEST_SIZE) * REQUEST_SIZE;
      const skipBytes = start - alignedStart;

      // Collect chunks into buffer
      const chunks = [];
      let collected = 0;
      const needed = length + skipBytes;

      const iter = c.iterDownload({
        file: fileLocation,
        offset: bigInt(alignedStart),
        requestSize: REQUEST_SIZE,
      });

      for await (const chunk of iter) {
        chunks.push(Buffer.from(chunk));
        collected += chunk.length;
        if (collected >= needed) break;
      }

      let buffer = Buffer.concat(chunks);

      // Trim to exact range
      buffer = buffer.subarray(skipBytes, skipBytes + length);

      console.log(`[Telegram] Sending ${buffer.length} bytes`);

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${start + buffer.length - 1}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': buffer.length,
        'Content-Type': mime,
      });
      res.end(buffer);
    } else {
      console.log(`[Telegram] Full download: ${total} bytes`);

      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
      });

      const iter = c.iterDownload({
        file: fileLocation,
        requestSize: REQUEST_SIZE,
      });

      for await (const chunk of iter) {
        if (!res.writable) break;
        res.write(Buffer.from(chunk));
      }
      res.end();
    }
  } catch (err) {
    console.error('[Telegram] Error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: `Telegram proxy failed: ${err.message}` });
    } else {
      res.end();
    }
  }
}
