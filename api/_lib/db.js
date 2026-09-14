// Postgres access for products, users and orders, via Neon's serverless
// driver — this is what Vercel's "Postgres" storage (Storage → Create
// Database → Postgres) provisions under the hood. Works over plain HTTPS,
// no connection pooling to manage.

const { neon } = require('@neondatabase/serverless');

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

function isConfigured() {
  return Boolean(getConnectionString());
}

let sqlClient = null;
function sql(...args) {
  if (!sqlClient) {
    const conn = getConnectionString();
    if (!conn) {
      throw new Error('No database connection string found (DATABASE_URL / POSTGRES_URL). Create a Postgres store for this project in the Vercel dashboard.');
    }
    sqlClient = neon(conn);
  }
  return sqlClient(...args);
}

let schemaReady = null;
async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        category TEXT NOT NULL DEFAULT 'General',
        image_url TEXT,
        stock INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        total_cents INTEGER NOT NULL DEFAULT 0,
        stripe_session_id TEXT UNIQUE,
        stripe_payment_intent_id TEXT,
        customer_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      )
    `;
  })();
  return schemaReady;
}

module.exports = { sql, ensureSchema, isConfigured };
