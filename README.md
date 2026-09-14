# Goat Hub 🐐

A responsive, multi-page marketing website for **Goat Hub**, a pasture-raised
goat farm — plus a real farm store (cart + Stripe checkout), customer
accounts with order history, and a password-protected admin panel for
images, inventory and orders.

The marketing pages are static; everything else is a handful of small
[Vercel Serverless Functions](https://vercel.com/docs/functions) backed by
[Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (images),
[Neon/Vercel Postgres](https://vercel.com/docs/storage) (products, accounts,
orders), and [Stripe](https://stripe.com) (payment).

## Pages

| Page | File |
| --- | --- |
| Home | `index.html` |
| About | `about.html` |
| Services | `services.html` |
| Gallery | `gallery.html` |
| Journal (Blog) | `blog.html` |
| Contact | `contact.html` |
| **Farm Store** | `store.html` |
| **My Account** (login/signup/orders) | `account.html` |
| **Admin** (images, inventory, orders) | `admin.html` |

## Structure

```
├── index.html … contact.html    # marketing pages
├── store.html, account.html     # store + customer accounts
├── admin.html                   # password-protected admin (Images / Inventory / Orders tabs)
├── css/                         # style.css (shared), admin.css, store.css, account.css
├── js/
│   ├── main.js                  # sticky header, mobile nav, scroll-reveal, counters, etc.
│   ├── cart.js                  # shared localStorage cart + header badge (loaded on every page)
│   ├── image-manifest.js        # applies admin-replaced images on every page load
│   ├── store.js, account.js, admin.js
├── assets/svg/, assets/img/     # bundled default illustrations, logo, icons, favicon
└── api/
    ├── login.js, logout.js, check-auth.js      # admin auth (shared password)
    ├── auth/signup.js, login.js, logout.js, me.js   # customer auth
    ├── products.js                              # public product list
    ├── orders/checkout.js, mine.js, confirm.js  # customer checkout + order history
    ├── stripe/webhook.js                        # marks orders paid, decrements stock
    ├── admin/products.js, product-update.js, product-delete.js
    ├── admin/orders.js, order-update.js
    ├── images/manifest.js, upload.js, reset.js
    └── _lib/                                    # shared helpers (auth.js, userAuth.js, db.js,
                                                  #   stripeClient.js, imageKeys.js, slugify.js)
                                                  #   "_"-prefixed, not routes
```

## How it fits together

- **Images**: every replaceable `<img>` carries its bundled default `src`
  plus `data-image-key="…"`. `js/image-manifest.js` fetches a public
  manifest and swaps in any admin-replaced image; if that fetch fails for
  any reason, the bundled default just keeps showing.
- **Store & cart**: `store.html` fetches `/api/products` and renders a
  grid; the cart itself lives in `localStorage` (`js/cart.js`, shared by
  every page) and only ever stores `{productId, quantity}` — prices are
  always re-read from the server at checkout, never trusted from the
  client.
- **Accounts**: `account.html` handles login/signup (bcrypt-hashed
  passwords) and shows order history. Sessions are a signed, HttpOnly
  cookie — separate from the admin's cookie, so the two logins never mix.
- **Checkout**: clicking Checkout requires being logged in; the server
  re-validates prices/stock, creates a Stripe Checkout Session, and
  records a `pending` order. Stripe's webhook then marks it `paid` and
  decrements stock once payment actually completes.
- **Admin**: one shared password unlocks all three tabs — Images,
  Inventory (add/edit/deactivate products), and Orders (mark
  fulfilled/cancelled).

## One-time setup (required — none of this can be done from code)

Everything below is a step in the **Vercel dashboard** (or Stripe's) for
this project. The site itself is unaffected by whichever pieces aren't set
up yet — the relevant feature just shows a clear "not set up yet" message
instead of erroring.

1. **Blob storage** (for the image admin) — Project → Storage → Create
   Database → **Blob**. Adds `BLOB_READ_WRITE_TOKEN` automatically.
2. **Postgres database** (for products/accounts/orders) — Project →
   Storage → Create Database → **Postgres**. Adds `DATABASE_URL` (and
   friends) automatically. Tables are created automatically on first use —
   no migration step needed.
3. **Admin password** — Settings → Environment Variables → add
   `ADMIN_PASSWORD` (whatever you want to log in to `/admin.html` with).
4. **Customer session secret** — Settings → Environment Variables → add
   `SESSION_SECRET`. Any long random string works; here's one already
   generated for you to paste in:
   ```
   391d201c0cd7b1d340c9b292d2b83228b816f2b1db9622a3c7aa77e8de4893c
   ```
5. **Stripe secret key** — create a [Stripe](https://dashboard.stripe.com)
   account if you don't have one, grab the **Secret key** (start with the
   test-mode one, `sk_test_…`) from Developers → API keys, and add it as
   `STRIPE_SECRET_KEY`.
6. **Stripe webhook** — Stripe Dashboard → Developers → Webhooks → Add
   endpoint:
   - Endpoint URL: `https://<your-domain>/api/stripe/webhook`
   - Event to send: `checkout.session.completed`
   - Copy the **Signing secret** (`whsec_…`) it gives you and add it as
     `STRIPE_WEBHOOK_SECRET`.

Redeploy after adding these (or just push again — Vercel picks up new env
vars on the next deploy). Switch `STRIPE_SECRET_KEY`/the webhook to your
live-mode keys whenever you're ready to accept real payments.

## Local preview

The marketing pages work with any static file server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`. The `/api/*` functions (and
therefore the store, accounts and admin panel) won't run under a plain
static server — use `vercel dev` (after `npm install`) if you want to
exercise those locally, with the same environment variables set in a
`.env.local` file.

## Deployment

Deploys to Vercel with zero configuration — it auto-detects the `api/`
folder as Node.js Serverless Functions and serves everything else
statically. `package.json` only exists for the dependencies those
functions use (`@vercel/blob`, `@neondatabase/serverless`, `bcryptjs`,
`stripe`).
