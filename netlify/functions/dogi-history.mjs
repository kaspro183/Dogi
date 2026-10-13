// GET /api/dogi-history -> daily DOGI price series (median price per day, in DOGE).
// { complete, source, updated, days: [[YYYY-MM-DD, medianPriceDOGE, dogiTraded, sales, dogeUsdThatDay], ...] }
// Data is prepared by the scheduled dogi-history-sync function and kept in Netlify Blobs.
import { loadState, series, syncStep, dogeUsdRates } from '../lib/history.mjs';

export default async () => {
  let state = await loadState();
  // very first call after deploy: prepare the data now instead of waiting for the schedule
  let syncError;
  // Each call while the backfill is unfinished (or when data is >30 min old) runs one sync step,
  // so the history fills up from normal visits even if the scheduled function doesn't run.
  const stale = !state.updated || Date.now() - Date.parse(state.updated) > 30 * 60 * 1000;
  if ((state.source !== 'chart' && !state.complete) || stale) {
    try { await syncStep(6500); } catch (e) { syncError = String(e && (e.stack || e.message) || e).slice(0, 400); }
    state = await loadState();
  }
  let days = series(state);
  // add that day's DOGE/USD close (last known rate if a day is missing), for the $ view
  let usdError;
  try {
    const rates = await dogeUsdRates();
    let last = null;
    days = days.map((d) => { if (rates[d[0]]) last = rates[d[0]]; return [d[0], d[1], d[2], d[3], last]; });
  } catch (e) { usdError = String(e.message || e); }
  const complete = state.source === 'chart' ? days.length > 0 : !!state.complete;
  return new Response(JSON.stringify({ complete, source: state.source || null, updated: state.updated || null,
    progress: state.source === 'sales' ? { offset: state.offset, total: state.total } : undefined,
    chartError: state.chartError, syncError, usdError, days }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': complete ? 'public, max-age=300' : 'no-store',
      'Netlify-CDN-Cache-Control': syncError ? 'no-store' : complete ? 'public, s-maxage=900, stale-while-revalidate=1800' : 'public, s-maxage=20',
    },
  });
};

export const config = { path: '/api/dogi-history' };
