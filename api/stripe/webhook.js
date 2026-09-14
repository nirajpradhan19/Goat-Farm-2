const { sql, ensureSchema, isConfigured: dbConfigured } = require('../_lib/db');
const { getStripe, isConfigured: stripeConfigured } = require('../_lib/stripeClient');

// Stripe signature verification needs the exact raw request body bytes,
// so the platform's automatic JSON body parsing must be disabled here.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(500).send('Stripe webhook is not configured');
    return;
  }

  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (!dbConfigured()) {
        res.status(200).json({ received: true, note: 'DB not configured, skipped' });
        return;
      }
      await ensureSchema();

      const orderRows = await sql`
        UPDATE orders
        SET status = 'paid',
            stripe_payment_intent_id = ${session.payment_intent || null},
            updated_at = now()
        WHERE stripe_session_id = ${session.id}
        RETURNING id
      `;

      if (orderRows.length > 0) {
        const orderId = orderRows[0].id;
        const items = await sql`SELECT product_id, quantity FROM order_items WHERE order_id = ${orderId}`;
        for (const item of items) {
          if (item.product_id) {
            await sql`
              UPDATE products
              SET stock = GREATEST(stock - ${item.quantity}, 0), updated_at = now()
              WHERE id = ${item.product_id}
            `;
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    // Returning 500 tells Stripe to retry the webhook later.
    res.status(500).send(`Webhook handler error: ${String(err && err.message ? err.message : err)}`);
  }
};
