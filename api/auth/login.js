const { sql, ensureSchema, isConfigured } = require('../_lib/db');
const { createUserSessionCookie, verifyPassword } = require('../_lib/userAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const genericError = () => res.status(401).json({ error: 'Incorrect email or password' });

  if (!email || !password) {
    genericError();
    return;
  }

  if (!isConfigured()) {
    res.status(500).json({ error: 'The store database is not set up yet.' });
    return;
  }

  try {
    await ensureSchema();
    const rows = await sql`SELECT id, email, name, password_hash FROM users WHERE email = ${email}`;
    if (rows.length === 0) {
      genericError();
      return;
    }
    const user = rows[0];
    const match = await verifyPassword(password, user.password_hash);
    if (!match) {
      genericError();
      return;
    }

    res.setHeader('Set-Cookie', createUserSessionCookie(user.id));
    res.status(200).json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', detail: String(err && err.message ? err.message : err) });
  }
};
