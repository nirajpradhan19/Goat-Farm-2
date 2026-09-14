// Shared auth helpers for the admin image-manager API.
// Not a route itself (files/folders under api/ prefixed with "_" are not
// exposed as Serverless Function endpoints by Vercel).

const crypto = require('crypto');

const COOKIE_NAME = 'goathub_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSessionSecret() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD environment variable is not set');
  }
  // Derive a signing secret from the admin password so only one env var
  // is required. This is not the password itself, so it's safe to use
  // for signing cookies even though it's derived deterministically.
  return crypto.createHash('sha256').update(`goathub-session-secret:${password}`).digest('hex');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSessionCookie() {
  const secret = getSessionSecret();
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = sign(exp, secret);
  const value = `${exp}.${sig}`;
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function isAuthenticated(req) {
  try {
    const secret = getSessionSecret();
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;
    const [exp, sig] = token.split('.');
    if (!exp || !sig) return false;
    const expected = sign(exp, secret);
    if (!timingSafeEqual(sig, expected)) return false;
    if (Date.now() > Number(exp)) return false;
    return true;
  } catch {
    return false;
  }
}

function requireAuth(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

module.exports = {
  COOKIE_NAME,
  createSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  requireAuth,
  getSessionSecret,
};
