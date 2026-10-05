// Public list of pledges for pledge.html (names + amounts only, no Telegram IDs)
import { getStore } from '@netlify/blobs';

export default async () => {
  try {
    const store = getStore('pledges');
    const { blobs } = await store.list();
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)));
    const pledges = items.filter(Boolean).map(({ name, doge, dogi, date, updated }) => ({ name, doge, dogi, date: (date || '').slice(0, 10), updated }));
    const last = pledges.reduce((m, p) => (p.updated > m ? p.updated : m), '');
    return new Response(JSON.stringify({ goalUsd: 100000, updated: last ? last.slice(0, 16).replace('T', ' ') + ' UTC' : null, pledges }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30', 'Netlify-CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/pledges' };
