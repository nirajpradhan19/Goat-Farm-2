const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireAuth(req, res)) return;
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
        FROM order_items
        WHERE order_id = ANY(${orderIds})
      `;
      for (const item of items) {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
        itemsByOrder.get(item.order_id).push(item);
      }
    }

    const result = orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] }));
    res.status(200).json({ orders: result });
  } catch (err) {
    res.status(500).json({ error: 'Could not load orders', detail: String(err && err.message ? err.message : err) });
  }
};
