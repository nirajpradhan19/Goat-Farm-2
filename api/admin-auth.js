const crypto = require('crypto');
const { createSessionCookie, clearSessionCookie, isAuthenticated } = require('./_lib/auth');

// Consolidated admin auth endpoint (login/logout/check) — kept as one
// route rather than three so this project stays under Vercel's
// per-deployment Serverless Function count limit.
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ authenticated: isAuthenticated(req) });
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
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  if (body.action === 'login') {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      res.status(500).json({ error: 'Admin panel is not configured (ADMIN_PASSWORD is not set).' });
      return;
    }
    const password = typeof body.password === 'string' ? body.password : '';
    const a = Buffer.from(password);
    const b = Buffer.from(adminPassword);
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!match) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }
    res.setHeader('Set-Cookie', createSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
};
