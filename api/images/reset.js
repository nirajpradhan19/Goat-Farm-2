const { list, del } = require('@vercel/blob');
const { requireAuth } = require('../_lib/auth');
const { isValidKey } = require('../_lib/imageKeys');

const PREFIX = 'site-images/';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireAuth(req, res)) return;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(500).json({ error: 'Blob storage is not set up yet.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const key = body && body.key;

  if (!isValidKey(key)) {
    res.status(400).json({ error: 'Unknown image key' });
    return;
  }

  try {
    const { blobs } = await list({ prefix: `${PREFIX}${key}.` });
    await Promise.all(blobs.map((b) => del(b.url)));
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed', detail: String(err && err.message ? err.message : err) });
  }
};
