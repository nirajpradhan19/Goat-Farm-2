const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');

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
  const id = Number(body && body.id);
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
    // If the product is referenced by any past order, keep order history
    // intact by deactivating instead of deleting.
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
};
