# DOGI — the first DRC-20 on Dogecoin

Community website for DOGI: about, DogeOS × Laika roadmap, news, buying guide and live stats.

- `index.html` — the whole site (single file, logo embedded)
- `netlify/functions/dogi.mjs` — serves `/api/dogi`, fetching live DOGI stats from Doggy Market server-side (avoids CORS) plus DOGE/USD
- `netlify.toml` — Netlify config

Deploy: connect this repo to Netlify (no build command, publish directory `.`). Check `https://<your-site>/api/dogi` returns JSON.

To add a news item, copy an `<a class="item">` block in the `#news` section of `index.html`.
