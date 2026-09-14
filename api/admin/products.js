const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');
const { slugify } = require('../_lib/slugify');

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validate the request body (if any) before touching the database, so a
  // bad request always gets a clear 400 regardless of infra state.
  let name = '';
  let description = '';
  let category = 'General';
  let priceCents = 0;
  let stock = 0;
  let imageUrl = null;

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    name = typeof body.name === 'string' ? body.name.trim() : '';
    description = typeof body.description === 'string' ? body.description.trim() : '';
    category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'General';
    priceCents = Number(body.priceCents);
    stock = Number.isInteger(Number(body.stock)) ? Number(body.stock) : 0;
    imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : null;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      res.status(400).json({ error: 'Price must be a non-negative number (in cents)' });
      return;
    }
  }

  if (!isConfigured()) {
    res.status(500).json({ error: 'The store database is not set up yet. Create a Postgres store for this project in the Vercel dashboard.' });
    return;
  }

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const products = await sql`
        SELECT id, slug, name, description, price_cents, category, image_url, stock, active, created_at
        FROM products
        ORDER BY created_at DESC
      `;
      res.status(200).json({ products });
      return;
    }

    let slug = slugify(name);
    const existing = await sql`SELECT id FROM products WHERE slug = ${slug}`;
    if (existing.length > 0) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const rows = await sql`
      INSERT INTO products (slug, name, description, price_cents, category, image_url, stock, active)
      VALUES (${slug}, ${name}, ${description}, ${priceCents}, ${category}, ${imageUrl}, ${stock}, TRUE)
      RETURNING *
    `;
    res.status(200).json({ ok: true, product: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Request failed', detail: String(err && err.message ? err.message : err) });
  }
};
