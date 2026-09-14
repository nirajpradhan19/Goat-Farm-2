const url = require('url');
const { sql, ensureSchema, isConfigured: dbConfigured } = require('./_lib/db');
const { requireUser } = require('./_lib/userAuth');
const { getStripe, isConfigured: stripeConfigured, getSiteOrigin } = require('./_lib/stripeClient');

// Consolidated customer orders endpoint (checkout / my orders / confirm
// one order) — kept as one route rather than three to stay under
// Vercel's per-deployment Serverless Function count limit.
module.exports = async function handler(req, res) {
  const userId = requireUser(req, res);
  if (!userId) return;

  if (req.method === 'GET') {
    const { query } = url.parse(req.url, true);
    const sessionId = typeof query.session_id === 'string' ? query.session_id : '';

    if (!dbConfigured()) {
      res.status(200).json(sessionId ? { order: null } : { orders: [] });
      return;
    }

    try {
      await ensureSchema();

      if (sessionId) {
        const orders = await sql`
          SELECT id, status, total_cents, created_at
          FROM orders WHERE stripe_session_id = ${sessionId} AND user_id = ${userId}
        `;
        if (orders.length === 0) {
          res.status(404).json({ error: 'Order not found' });
          return;
        }
        const order = orders[0];
        const items = await sql`
          SELECT product_name, unit_price_cents, quantity FROM order_items WHERE order_id = ${order.id}
        `;
        res.status(200).json({ order: { ...order, items } });
        return;
      }

      const orders = await sql`
        SELECT id, status, total_cents, created_at FROM orders
        WHERE user_id = ${userId} ORDER BY created_at DESC
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

  // ---- checkout ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const items = Array.isArray(body && body.items) ? body.items : [];

  if (items.length === 0) {
    res.status(400).json({ error: 'Your cart is empty' });
    return;
  }

  const requested = [];
  for (const item of items) {
    const productId = Number(item && item.productId);
    const quantity = Number(item && item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0 || quantity > 50) {
      res.status(400).json({ error: 'Invalid item in cart' });
      return;
    }
    requested.push({ productId, quantity });
  }

  if (!dbConfigured()) {
    res.status(500).json({ error: 'The store database is not set up yet.' });
    return;
  }
  if (!stripeConfigured()) {
    res.status(500).json({ error: 'Payments are not set up yet (STRIPE_SECRET_KEY is missing).' });
    return;
  }

  try {
    await ensureSchema();

    const userRows = await sql`SELECT id, email FROM users WHERE id = ${userId}`;
    if (userRows.length === 0) {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }
    const user = userRows[0];

    const ids = requested.map((r) => r.productId);
    const products = await sql`
      SELECT id, name, price_cents, stock, active FROM products
      WHERE id = ANY(${ids}) AND active = TRUE
    `;
    const byId = new Map(products.map((p) => [p.id, p]));

    const lineItems = [];
    const orderItemsToInsert = [];
    let totalCents = 0;

    for (const { productId, quantity } of requested) {
      const product = byId.get(productId);
      if (!product) {
        res.status(400).json({ error: 'A product in your cart is no longer available' });
        return;
      }
      if (product.stock < quantity) {
        res.status(400).json({ error: `Only ${product.stock} left of "${product.name}"` });
        return;
      }
      totalCents += product.price_cents * quantity;
      lineItems.push({
        quantity,
        price_data: { currency: 'usd', unit_amount: product.price_cents, product_data: { name: product.name } },
      });
      orderItemsToInsert.push({ productId: product.id, name: product.name, priceCents: product.price_cents, quantity });
    }

    const origin = getSiteOrigin(req);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: user.email,
      client_reference_id: String(user.id),
      success_url: `${origin}/account.html?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/store.html?order=cancelled`,
    });

    const orderRows = await sql`
      INSERT INTO orders (user_id, status, total_cents, stripe_session_id, customer_email)
      VALUES (${user.id}, 'pending', ${totalCents}, ${session.id}, ${user.email})
      RETURNING id
    `;
    const orderId = orderRows[0].id;

    for (const item of orderItemsToInsert) {
      await sql`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity)
        VALUES (${orderId}, ${item.productId}, ${item.name}, ${item.priceCents}, ${item.quantity})
      `;
    }

    res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Checkout failed', detail: String(err && err.message ? err.message : err) });
  }
};
