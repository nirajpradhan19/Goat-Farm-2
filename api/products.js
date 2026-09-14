const { sql, ensureSchema, isConfigured } = require('./_lib/db');

// Public: list active products for the store page.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isConfigured()) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ products: [] });
    return;
  }

  try {
    await ensureSchema();
    const products = await sql`
      SELECT id, slug, name, description, price_cents, category, image_url, stock
      FROM products
      WHERE active = TRUE
      ORDER BY category, name
    `;
    res.setHeader('Cache-Control', 'public, max-age=10');
    res.status(200).json({ products });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ products: [] });
  }
};
