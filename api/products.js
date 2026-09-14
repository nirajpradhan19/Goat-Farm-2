const { sql, ensureSchema, isConfigured } = require('./_lib/db');
const { isAuthenticated, requireAuth } = require('./_lib/auth');
const { slugify } = require('./_lib/slugify');

// Consolidated products endpoint: public GET returns active products with
// public fields; an admin-authenticated GET returns every product with
// full fields. POST (admin only) creates/updates/deletes. Kept as one
// route rather than four to stay under Vercel's per-deployment
// Serverless Function count limit.
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const admin = isAuthenticated(req);
    if (!isConfigured()) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ products: [] });
      return;
    }
    try {
      await ensureSchema();
      const products = admin
        ? await sql`
            SELECT id, slug, name, description, price_cents, category, image_url, stock, active, created_at
            FROM products ORDER BY created_at DESC
          `
        : await sql`
            SELECT id, slug, name, description, price_cents, category, image_url, stock
            FROM products WHERE active = TRUE ORDER BY category, name
          `;
      if (!admin) res.setHeader('Cache-Control', 'public, max-age=10');
      res.status(200).json({ products });
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ products: [] });
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

  if (body.action === 'delete') {
    const id = Number(body.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Missing product id' });
      return;
    }
    if (!isConfigured()) {
      res.status(500).json({ error: 'The store database is not set up yet.' });
      return;
    }
    try {
      await ensureSchema();
      const referenced = await sql`SELECT 1 FROM order_items WHERE product_id = ${id} LIMIT 1`;
      if (referenced.length > 0) {
        await sql`UPDATE products SET active = FALSE, updated_at = now() WHERE id = ${id}`;
        res.status(200).json({ ok: true, deactivatedInstead: true });
        return;
      }
      await sql`DELETE FROM products WHERE id = ${id}`;
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Delete failed', detail: String(err && err.message ? err.message : err) });
    }
    return;
  }

  // action === 'create' or 'update'
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'General';
  const priceCents = Number(body.priceCents);
  const stock = Number.isInteger(Number(body.stock)) ? Number(body.stock) : 0;
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : null;

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    res.status(400).json({ error: 'Price must be a non-negative number (in cents)' });
    return;
  }

  if (body.action === 'update') {
    const id = Number(body.id);
    const active = Boolean(body.active);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Missing product id' });
      return;
    }
    if (!isConfigured()) {
      res.status(500).json({ error: 'The store database is not set up yet.' });
      return;
    }
    try {
      await ensureSchema();
      const rows = await sql`
        UPDATE products
        SET name = ${name}, description = ${description}, category = ${category},
            price_cents = ${priceCents}, image_url = ${imageUrl}, stock = ${stock},
            active = ${active}, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.status(200).json({ ok: true, product: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Update failed', detail: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (body.action === 'create') {
    if (!isConfigured()) {
      res.status(500).json({ error: 'The store database is not set up yet. Create a Postgres store for this project in the Vercel dashboard.' });
      return;
    }
    try {
      await ensureSchema();
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
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
};
