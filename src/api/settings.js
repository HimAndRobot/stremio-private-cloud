import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// Get a setting value
export function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

// Set a setting value
export function setSetting(key, value) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// Get all integration settings
router.get('/integrations', (req, res) => {
  res.json({
    telegram: {
      configured: !!(getSetting('telegram_api_id') && getSetting('telegram_api_hash')),
      api_id: getSetting('telegram_api_id') || '',
      logged_in: !!(getSetting('telegram_session') && getSetting('telegram_session').length > 0),
    },
  });
});

// Save Telegram credentials
router.post('/integrations/telegram', (req, res) => {
  const { api_id, api_hash } = req.body;
  if (!api_id || !api_hash) {
    return res.status(400).json({ error: 'api_id and api_hash are required' });
  }

  setSetting('telegram_api_id', String(api_id));
  setSetting('telegram_api_hash', String(api_hash));

  res.json({ saved: true });
});

// Send login code
router.post('/integrations/telegram/send-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    const { sendCode } = await import('../streaming/telegram.js');
    const phoneCodeHash = await sendCode(phone);
    res.json({ sent: true, phoneCodeHash });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Verify login code
router.post('/integrations/telegram/verify-code', async (req, res) => {
  const { phone, code, phoneCodeHash } = req.body;
  if (!phone || !code || !phoneCodeHash) {
    return res.status(400).json({ error: 'phone, code, and phoneCodeHash are required' });
  }

  try {
    const { verifyCode } = await import('../streaming/telegram.js');
    await verifyCode(phone, code, phoneCodeHash);
    res.json({ logged_in: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Logout
router.post('/integrations/telegram/logout', async (req, res) => {
  try {
    const { logout } = await import('../streaming/telegram.js');
    await logout();
  } catch { /* ignore */ }
  res.json({ logged_out: true });
});

// Remove Telegram integration entirely
router.delete('/integrations/telegram', (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key LIKE 'telegram_%'").run();
  res.json({ deleted: true });
});

export default router;
