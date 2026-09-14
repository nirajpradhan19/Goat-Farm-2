# Goat Hub 🐐

A responsive, multi-page marketing website for **Goat Hub**, a pasture-raised
goat farm offering dairy products, breeding stock, meat goats, mohair fiber,
farm tours, and herd health consulting.

Built as a static site (no build step, no framework) so it deploys anywhere,
including zero-config on [Vercel](https://vercel.com).

## Pages

| Page | File |
| --- | --- |
| Home | `index.html` |
| About | `about.html` |
| Services | `services.html` |
| Gallery | `gallery.html` |
| Journal (Blog) | `blog.html` |
| Contact | `contact.html` |

## Structure

```
├── index.html / about.html / services.html / gallery.html / blog.html / contact.html
├── css/style.css        # shared stylesheet (design tokens, components, responsive rules)
├── js/main.js            # sticky header, mobile nav, scroll-reveal, counters,
│                          #   testimonial slider, FAQ accordion, gallery filter, demo forms
└── assets/svg/            # hand-built illustrations, logo, icons, favicon
```

All illustrations are original inline/embedded SVGs — no external image
dependencies, so the site has no third-party asset requests besides Google
Fonts.

## Local preview

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

## Deployment

This is a plain static site — no build command or output directory needed.
It deploys directly to Vercel (or any static host) as-is.
