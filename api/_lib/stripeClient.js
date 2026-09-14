const Stripe = require('stripe');

let client = null;
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  if (!client) {
    client = new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return client;
}

function isConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getSiteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

module.exports = { getStripe, isConfigured, getSiteOrigin };
