const url = require('url');
const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { requireUser } = require('../_lib/userAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const userId = requireUser(req, res);
  if (!userId) return;

  const { query } = url.parse(req.url, true);
  const sessionId = typeof query.session_id === 'string' ? query.session_id : '';
  if (!sessionId) {
    res.status(400).json({ error: 'Missing session_id' });
    return;
  }

  if (!isConfigured()) {
    res.status(200).json({ order: null });
    return;
  }

  try {
    await ensureSchema();
    const orders = await sql`
      SELECT id, status, total_cents, created_at
      FROM orders
      WHERE stripe_session_id = ${sessionId} AND user_id = ${userId}
    `;
    if (orders.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const order = orders[0];
    const items = await sql`
      SELECT product_name, unit_price_cents, quantity
      FROM order_items
      WHERE order_id = ${order.id}
    `;
    res.status(200).json({ order: { ...order, items } });
  } catch (err) {
    res.status(500).json({ error: 'Could not load order', detail: String(err && err.message ? err.message : err) });
  }
};
