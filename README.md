# DOGI — the first DRC-20 on Dogecoin

Community website for DOGI: about, DogeOS × Laika roadmap, news, buying guide and live stats.

- `index.html` — home (hero, live stats, overview, latest news)
- `about.html`, `dogeos.html`, `news.html`, `buy.html` — one page per section
- `assets/style.css`, `assets/app.js`, `assets/logo.webp` — shared style, script and logo
- `netlify/functions/dogi.mjs` — serves `/api/dogi`, fetching live DOGI stats from Doggy Market server-side (avoids CORS) plus DOGE/USD
- `netlify.toml` — Netlify config

Deploy: connect this repo to Netlify (no build command, publish directory `.`). Check `https://<your-site>/api/dogi` returns JSON.

To add a news item, copy an `<a class="item">` block in `news.html` (and in the Latest block of `index.html` to show it on the home page).

## Liquidity pledge bot (Telegram)

`pledge.html` shows community pledges for the DOGI/DOGE pool. Pledges are collected by a Telegram bot in the DOGI group and stored in Netlify Blobs.

- `/api/tg-pledge`: Telegram webhook (`/pledge 5000 DOGE 5000 DOGI`, `/unpledge`, `/pledges`). One pledge per Telegram account. Only counts in the group set by `TG_CHAT` (default `dogi_doginals_drc20`).
- `/api/pledges`: public list used by `pledge.html` (names and amounts only).
- `/api/tg-setup?key=<TG_WEBHOOK_SECRET>`: open once to register the webhook and the command menu.

Netlify environment variables: `TG_BOT_TOKEN` (from @BotFather), `TG_WEBHOOK_SECRET` (any long random string), optional `TG_CHAT`. Redeploy after adding them.
