const { put, list, del } = require('@vercel/blob');
const { requireAuth } = require('./_lib/auth');
const { isValidKey } = require('./_lib/imageKeys');

const PREFIX = 'site-images/';
const MAX_BYTES = 3 * 1024 * 1024; // 3MB — comfortably under Vercel's request body limit once base64-encoded

const EXT_BY_TYPE = {
  'image/svg+xml': '.svg',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Consolidated image-admin endpoint (public manifest read + admin
// upload/reset) — kept as one route rather than three to stay under
// Vercel's per-deployment Serverless Function count limit.
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({});
      return;
    }
    try {
      const { blobs } = await list({ prefix: PREFIX });
      const manifest = {};
      for (const blob of blobs) {
        const rest = blob.pathname.slice(PREFIX.length);
        const key = rest.replace(/\.[^./]+$/, '');
        if (key) manifest[key] = blob.url;
      }
      res.setHeader('Cache-Control', 'public, max-age=15');
      res.status(200).json(manifest);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({});
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireAuth(req, res)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  if (body.action === 'reset') {
    const key = body.key;
    if (!isValidKey(key)) {
      res.status(400).json({ error: 'Unknown image key' });
      return;
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(500).json({ error: 'Blob storage is not set up yet.' });
      return;
    }
    try {
      const { blobs } = await list({ prefix: `${PREFIX}${key}.` });
      await Promise.all(blobs.map((b) => del(b.url)));
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Reset failed', detail: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (body.action === 'upload') {
    const { key, contentType, dataBase64 } = body;

    if (!isValidKey(key)) {
      res.status(400).json({ error: 'Unknown image key' });
      return;
    }
    if (!contentType || !EXT_BY_TYPE[contentType]) {
      res.status(400).json({ error: 'Unsupported image type. Use SVG, PNG, JPEG, WebP or GIF.' });
      return;
    }
    if (!dataBase64 || typeof dataBase64 !== 'string') {
      res.status(400).json({ error: 'Missing file data' });
      return;
    }

    let buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'Invalid file data' });
      return;
    }
    if (buffer.length === 0) {
      res.status(400).json({ error: 'File is empty' });
      return;
    }
    if (buffer.length > MAX_BYTES) {
      res.status(400).json({ error: `File is too large (max ${Math.floor(MAX_BYTES / 1024 / 1024)}MB)` });
      return;
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(500).json({ error: 'Blob storage is not set up yet. Create a Blob store for this project in the Vercel dashboard (Storage → Create Database → Blob), then redeploy.' });
      return;
    }

    try {
      const { blobs } = await list({ prefix: `${PREFIX}${key}.` });
      await Promise.all(blobs.map((b) => del(b.url)));

      const pathname = `${PREFIX}${key}${EXT_BY_TYPE[contentType]}`;
      const result = await put(pathname, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType,
        cacheControlMaxAge: 60,
      });
      res.status(200).json({ ok: true, url: result.url });
    } catch (err) {
      res.status(500).json({ error: 'Upload failed', detail: String(err && err.message ? err.message : err) });
    }
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
};
