# DOGI — the first DRC-20 on Dogecoin

Community website for DOGI: about, DogeOS × Laika roadmap, news, buying guide and live stats.

- `index.html` — home (hero, live stats, overview, latest news)
- `about.html`, `dogeos.html`, `news.html`, `buy.html` — one page per section
- `assets/style.css`, `assets/app.js`, `assets/logo.webp` — shared style, script and logo
- `netlify/functions/dogi.mjs` — serves `/api/dogi`, fetching live DOGI stats from Doggy Market server-side (avoids CORS) plus DOGE/USD
- `netlify.toml` — Netlify config

Deploy: connect this repo to Netlify (no build command, publish directory `.`). Check `https://<your-site>/api/dogi` returns JSON.

To add a news item, copy an `<a class="item">` block in `news.html` (and in the Latest block of `index.html` to show it on the home page).

## Liquidity pledges

`pledge.html` tracks self-declared community pledges for the DOGI/DOGE pool on DogeOS.

- `/api/pledge-submit` (POST): form submission. One pledge per Telegram username (re-submitting replaces it), amount caps, honeypot and a 5-per-hour rate limit per connection.
- `/api/pledges` (GET): public list (names and amounts) used by the page. Stored in Netlify Blobs, no setup needed.
- To remove or fix a pledge: Netlify dashboard → Blobs → store `pledges`, delete the key `n<username>`.
