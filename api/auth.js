const { sql, ensureSchema, isConfigured } = require('./_lib/db');
const {
  createUserSessionCookie,
  clearUserSessionCookie,
  getUserIdFromRequest,
  hashPassword,
  verifyPassword,
  isValidEmail,
} = require('./_lib/userAuth');

// Consolidated customer auth endpoint (signup/login/logout/me) — kept as
// one route rather than four to stay under Vercel's per-deployment
// Serverless Function count limit.
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    var userId = getUserIdFromRequest(req);
    if (!userId || !isConfigured()) {
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

  if (body.action === 'logout') {
    res.setHeader('Set-Cookie', clearUserSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  if (body.action === 'signup') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Enter a valid email address' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }
    if (!isConfigured()) {
      res.status(500).json({ error: 'The store database is not set up yet. Create a Postgres store for this project in the Vercel dashboard.' });
      return;
    }

    try {
      await ensureSchema();
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) {
        res.status(409).json({ error: 'An account with that email already exists' });
        return;
      }
      const passwordHash = await hashPassword(password);
      const rows = await sql`
        INSERT INTO users (email, password_hash, name)
        VALUES (${email}, ${passwordHash}, ${name})
        RETURNING id, email, name
      `;
      const user = rows[0];
      res.setHeader('Set-Cookie', createUserSessionCookie(user.id));
      res.status(200).json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
      res.status(500).json({ error: 'Signup failed', detail: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (body.action === 'login') {
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
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
};
