// Session helpers for customer accounts (signup/login/profile/orders).
// Deliberately separate from api/_lib/auth.js, which handles the single
// shared admin password — these are unrelated trust boundaries.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'goathub_user_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return secret;
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

function createUserSessionCookie(userId) {
  const secret = getSecret();
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = sign(payload, secret);
  const value = `${payload}.${sig}`;
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearUserSessionCookie() {
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

function getUserIdFromRequest(req) {
  try {
    const secret = getSecret();
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [userId, exp, sig] = parts;
    const payload = `${userId}.${exp}`;
    const expected = sign(payload, secret);
    if (!timingSafeEqual(sig, expected)) return null;
    if (Date.now() > Number(exp)) return null;
    const id = Number(userId);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function requireUser(req, res) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: 'Not logged in' });
    return null;
  }
  return userId;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  COOKIE_NAME,
  createUserSessionCookie,
  clearUserSessionCookie,
  getUserIdFromRequest,
  requireUser,
  hashPassword,
  verifyPassword,
  isValidEmail,
};
