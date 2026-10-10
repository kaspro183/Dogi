// GET /api/dogi-history -> daily DOGI price series (median price per day, in DOGE).
// { complete, source, updated, days: [[YYYY-MM-DD, medianPriceDOGE, dogiTraded, sales], ...] }
// Data is prepared by the scheduled dogi-history-sync function and kept in Netlify Blobs.
import { loadState, series, syncStep } from '../lib/history.mjs';

export default async () => {
  let state = await loadState();
  // very first call after deploy: prepare the data now instead of waiting for the schedule
  if (!state.updated) { try { await syncStep(8000); } catch {} state = await loadState(); }
  const days = series(state);
  const complete = state.source === 'chart' ? days.length > 0 : !!state.complete;
  return new Response(JSON.stringify({ complete, source: state.source || null, updated: state.updated || null,
    progress: state.source === 'sales' ? { offset: state.offset, total: state.total } : undefined, days }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Netlify-CDN-Cache-Control': complete ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'public, s-maxage=120',
    },
  });
};

export const config = { path: '/api/dogi-history' };
