// POST /api/pledge-submit  {name, doge, dogi, website}
// Self-declared liquidity pledges. One pledge per Telegram username (re-submitting replaces it).
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

const MAX_DOGE = 20_000, MAX_DOGI = 20_000;
const RATE_MAX = 5, RATE_WINDOW = 60 * 60 * 1000; // 5 submissions per hour per connection
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function amount(v) {
  if (v === '' || v == null) return 0;
  const n = Number(String(v).replace(/[\s,_']/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }

  if (body.website) return json({ ok: true }); // honeypot: silently ignore bots

  const raw = String(body.name || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{4,32}$/.test(raw)) return json({ error: 'Enter your Telegram @username (letters, numbers, _).' }, 400);
  const doge = amount(body.doge), dogi = amount(body.dogi);
  if (Number.isNaN(doge) || Number.isNaN(dogi)) return json({ error: 'Amounts must be numbers.' }, 400);
  if (doge === 0 && dogi === 0) return json({ error: 'Enter a DOGE and/or DOGI amount.' }, 400);
  if (doge > MAX_DOGE || dogi > MAX_DOGI) return json({ error: 'Max 20,000 DOGE and 20,000 DOGI per pledge.' }, 400);

  // rate limit per connection (hashed, never stored in clear)
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const ipKey = 'r' + createHash('sha256').update(ip + (process.env.SITE_ID || 'dogi')).digest('hex').slice(0, 24);
  const rl = getStore('pledge-ratelimit');
  const now = Date.now();
  const hits = ((await rl.get(ipKey, { type: 'json' }).catch(() => null)) || []).filter((t) => now - t < RATE_WINDOW);
  if (hits.length >= RATE_MAX) return json({ error: 'Too many submissions. Try again in an hour.' }, 429);
  hits.push(now);
  await rl.setJSON(ipKey, hits);

  const store = getStore('pledges');
  const key = 'n' + raw.toLowerCase();
  const existing = await store.get(key, { type: 'json' }).catch(() => null);
  const iso = new Date().toISOString();
  await store.setJSON(key, { name: '@' + raw, doge, dogi, date: existing?.date || iso, updated: iso });
  return json({ ok: true, updated: !!existing, name: '@' + raw, doge, dogi });
};

export const config = { path: '/api/pledge-submit' };
