const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');

const ALLOWED_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled'];

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
  const status = body.status;

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Missing order id' });
    return;
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    return;
  }

  if (!isConfigured()) {
    res.status(500).json({ error: 'The store database is not set up yet.' });
    return;
  }

  try {
    await ensureSchema();
    const rows = await sql`
      UPDATE orders SET status = ${status}, updated_at = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Update failed', detail: String(err && err.message ? err.message : err) });
  }
};
