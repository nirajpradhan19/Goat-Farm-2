const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { getUserIdFromRequest } = require('../_lib/userAuth');

module.exports = async function handler(req, res) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(200).json({ user: null });
    return;
  }
  if (!isConfigured()) {
    res.status(200).json({ user: null });
    return;
  }

  try {
    await ensureSchema();
    const rows = await sql`SELECT id, email, name FROM users WHERE id = ${userId}`;
    res.status(200).json({ user: rows[0] || null });
  } catch {
    res.status(200).json({ user: null });
  }
};
