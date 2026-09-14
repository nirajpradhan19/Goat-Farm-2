const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');

// Always writes the full record (the admin UI sends the complete,
// edited object) — this keeps the SQL static rather than needing to
// compose a dynamic SET clause per-field.
module.exports = async function handler(req, res) {
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

  const id = Number(body.id);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'General';
  const priceCents = Number(body.priceCents);
  const stock = Number.isInteger(Number(body.stock)) ? Number(body.stock) : 0;
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : null;
  const active = Boolean(body.active);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Missing product id' });
    return;
  }
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    res.status(400).json({ error: 'Price must be a non-negative number (in cents)' });
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
      SET name = ${name},
          description = ${description},
          category = ${category},
          price_cents = ${priceCents},
          image_url = ${imageUrl},
          stock = ${stock},
          active = ${active},
          updated_at = now()
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
};
