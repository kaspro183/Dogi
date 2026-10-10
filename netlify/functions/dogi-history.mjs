// GET /api/dogi-history -> daily DOGI price series from Doggy Market's own chart data.
// Source: https://api.doggy.market/listings/tick/dogi/chart = [{ date: ms, price: shibes per DOGI }, ...]
// (one point per sale). We reduce it to one point per day (median) to keep the payload small.
// Response: { complete, updated, points, days: [[YYYY-MM-DD, medianPriceDOGE, 0, sales], ...] }
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (DOGI community site)',
  'Accept': 'application/json',
  'Origin': 'https://doggy.market',
  'Referer': 'https://doggy.market/dogi',
};
const SHIBE = 1e8;
const median = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

export default async () => {
  try {
    const r = await fetch('https://api.doggy.market/listings/tick/dogi/chart', { headers: HEADERS });
    if (!r.ok) throw new Error('doggy.market ' + r.status);
    const raw = await r.json();
    const list = Array.isArray(raw) ? raw : (raw?.data || []);
    const byDay = {};
    for (const p of list) {
      const t = Number(p?.date), price = Number(p?.price) / SHIBE;
      if (!isFinite(t) || !(price > 0)) continue;
      (byDay[new Date(t).toISOString().slice(0, 10)] ||= []).push(price);
    }
    const days = Object.keys(byDay).sort().map((d) => [d, +median(byDay[d]).toPrecision(5), 0, byDay[d].length]);
    return new Response(JSON.stringify({ complete: days.length > 0, updated: new Date().toISOString(), points: list.length, days }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ complete: false, error: String(e.message || e) }), {
      status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};

export const config = { path: '/api/dogi-history' };
