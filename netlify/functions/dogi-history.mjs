// GET /api/dogi-history -> daily DOGI price series built from every Doggy Market sale.
// { complete, updated, total, days: [[YYYY-MM-DD, medianPriceDOGE, dogiTraded, trades], ...] }
// ?sync runs one sync step (useful right after the first deploy, before the schedule kicks in).
import { loadState, series, syncStep } from '../lib/history.mjs';

export default async (req) => {
  const url = new URL(req.url);
  let sync = null;
  let state = await loadState();
  // manual sync is only allowed while the first backfill is still running
  if (url.searchParams.has('sync') && !state.complete) {
    try { sync = await syncStep(8000); } catch (e) { sync = { error: String(e.message || e) }; }
    state = await loadState();
  }
  const days = series(state);
  const body = { complete: state.complete, updated: state.updated || null, total: state.total,
                 counted: days.reduce((t, d) => t + d[3], 0), days };
  if (sync) body.sync = sync;
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': sync ? 'no-store' : 'public, max-age=300',
      'Netlify-CDN-Cache-Control': sync ? 'no-store' : 'public, s-maxage=600, stale-while-revalidate=1800',
    },
  });
};

export const config = { path: '/api/dogi-history' };
