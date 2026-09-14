const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { requireUser } = require('../_lib/userAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const userId = requireUser(req, res);
  if (!userId) return;

  if (!isConfigured()) {
    res.status(200).json({ orders: [] });
    return;
  }

  try {
    await ensureSchema();
    const orders = await sql`
      SELECT id, status, total_cents, created_at
      FROM orders
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    const orderIds = orders.map((o) => o.id);
    let itemsByOrder = new Map();
    if (orderIds.length > 0) {
      const items = await sql`
        SELECT order_id, product_name, unit_price_cents, quantity
        FROM order_items
        WHERE order_id = ANY(${orderIds})
      `;
      itemsByOrder = new Map();
      for (const item of items) {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
        itemsByOrder.get(item.order_id).push(item);
      }
    }

    const result = orders.map((o) => ({
      ...o,
      items: itemsByOrder.get(o.id) || [],
    }));

    res.status(200).json({ orders: result });
  } catch (err) {
    res.status(500).json({ error: 'Could not load orders', detail: String(err && err.message ? err.message : err) });
  }
};
