const { sql, ensureSchema, isConfigured } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

const ALLOWED_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled'];

// Consolidated admin orders endpoint (list all + update status) — kept
// as one route rather than two to stay under Vercel's per-deployment
// Serverless Function count limit.
module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'GET') {
    if (!isConfigured()) {
      res.status(200).json({ orders: [] });
      return;
    }
    try {
      await ensureSchema();
      const orders = await sql`
        SELECT o.id, o.status, o.total_cents, o.customer_email, o.created_at,
               u.name AS user_name, u.email AS user_email
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
        LIMIT 200
      `;
      const orderIds = orders.map((o) => o.id);
      let itemsByOrder = new Map();
      if (orderIds.length > 0) {
        const items = await sql`
          SELECT order_id, product_name, unit_price_cents, quantity
          FROM order_items WHERE order_id = ANY(${orderIds})
        `;
        for (const item of items) {
          if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
          itemsByOrder.get(item.order_id).push(item);
        }
      }
      res.status(200).json({ orders: orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] })) });
    } catch (err) {
      res.status(500).json({ error: 'Could not load orders', detail: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
      UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${id} RETURNING id
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
