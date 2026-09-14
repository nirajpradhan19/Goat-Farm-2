const { list } = require('@vercel/blob');

const PREFIX = 'site-images/';

// Public endpoint: returns { key: url } for every image that has been
// replaced via the admin panel. Keys with no entry here simply keep
// using the bundled default asset — this is intentionally readable by
// anyone, same as the images themselves are public on the live site.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Blob storage isn't set up yet — behave as if nothing has been
    // customized rather than erroring, so the site still renders fine.
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
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({});
  }
};
