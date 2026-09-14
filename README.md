# Goat Hub 🐐

A responsive, multi-page marketing website for **Goat Hub**, a pasture-raised
goat farm offering dairy products, breeding stock, meat goats, mohair fiber,
farm tours, and herd health consulting — plus a password-protected admin
panel for replacing any image on the site without touching code.

The site itself is static (no build step, no framework); the admin panel
adds a handful of small [Vercel Serverless Functions](https://vercel.com/docs/functions)
and [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) storage.

## Pages

| Page | File |
| --- | --- |
| Home | `index.html` |
| About | `about.html` |
| Services | `services.html` |
| Gallery | `gallery.html` |
| Journal (Blog) | `blog.html` |
| Contact | `contact.html` |
| **Image Admin** | `admin.html` |

## Structure

```
├── index.html / about.html / services.html / gallery.html / blog.html / contact.html
├── admin.html             # password-protected image manager
├── css/style.css          # shared stylesheet (design tokens, components, responsive rules)
├── css/admin.css          # admin panel styles
├── js/main.js             # sticky header, mobile nav, scroll-reveal, counters,
│                          #   testimonial slider, FAQ accordion, gallery filter, demo forms
├── js/image-manifest.js   # applies any admin-replaced images on every page load
├── js/admin.js            # admin panel client logic
├── assets/svg/, assets/img/  # bundled default illustrations, logo, icons, favicon
└── api/                   # serverless functions backing the admin panel
    ├── login.js, logout.js, check-auth.js
    ├── _lib/auth.js       # signed-cookie session helpers (not a route — "_" prefix)
    ├── _lib/imageKeys.js  # whitelist of images the admin panel may replace
    └── images/manifest.js, upload.js, reset.js
```

All bundled illustrations are original inline/embedded SVGs — no third-party
image dependencies, so the base site has no external asset requests besides
Google Fonts.

## How the image admin panel works

Every replaceable `<img>` in the HTML carries its bundled default `src` **and**
a `data-image-key="…"` attribute. On every page load, `js/image-manifest.js`
fetches `/api/images/manifest` (a public, read-only endpoint) and swaps in a
replacement URL for any key that's been customized — otherwise the bundled
default keeps showing. If the fetch fails for any reason (offline, JS
disabled, Blob not set up yet), the page already has a working default
`src`, so nothing breaks.

The admin panel (`admin.html`) lets you log in with one shared password and
upload a replacement for any of the ~20 known image slots (logo, favicon,
hero image, gallery photos, journal thumbnails, team portraits, the map,
etc.). Uploads go to Vercel Blob storage and go live for every visitor
immediately — no redeploy needed. "Reset to Default" removes a replacement.

### One-time setup (required before the admin panel will work)

Two things need to be configured in the **Vercel dashboard** for the project
— these can't be done from code:

1. **Create a Blob store** — Project → Storage → Create Database → **Blob**.
   This automatically adds a `BLOB_READ_WRITE_TOKEN` environment variable;
   you don't need to copy anything yourself.
2. **Set the admin password** — Project → Settings → Environment Variables →
   add `ADMIN_PASSWORD` with whatever password you want to log in with.

Redeploy (or just wait for the next push) after adding these. Until they're
both set, the main site works exactly as before — the admin panel will just
show a clear "not set up yet" message instead of a working upload.

## Local preview

The marketing pages work with any static file server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`. The `/api/*` functions won't
run under a plain static server — use `vercel dev` (after `npm install`) if
you want to exercise the admin panel locally.

## Deployment

Deploys to Vercel with zero configuration — it auto-detects the `api/`
folder as Node.js Serverless Functions and serves everything else
statically. `package.json` only exists for the `@vercel/blob` dependency
those functions use.
