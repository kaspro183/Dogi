// Shared logic for the DOGI price history.
// Preferred source: Doggy Market's own chart data (one request). If that endpoint refuses
// the request (it answers 403 to some servers), fall back to every completed DOGI sale
// on Doggy Market (newest first, paged by offset).
// State lives in Netlify Blobs so the full history (50k+ sales since 2023) is fetched
// once, a few thousand sales per run, then kept up to date with only the newest sales.
import { getStore } from '@netlify/blobs';

const API = 'https://api.doggy.market/listings/tick/dogi/orders';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (DOGI community site)',
  'Accept': 'application/json',
  'Origin': 'https://doggy.market',
  'Referer': 'https://doggy.market/dogi',
};
const SHIBE = 1e8;
const CHART = 'https://api.doggy.market/listings/tick/dogi/chart';
const BROWSER = { ...HEADERS,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' };

// [{date: ms, price: shibes}] -> daily [day, median DOGE, 0, sales]
async function chartDays() {
  const r = await fetch(CHART, { headers: BROWSER });
  if (!r.ok) throw new Error('chart ' + r.status);
  const raw = await r.json();
  const list = Array.isArray(raw) ? raw : (raw?.data || []);
  const byDay = {};
  for (const p of list) {
    const t = Number(p?.date), price = Number(p?.price) / SHIBE;
    if (!isFinite(t) || !(price > 0)) continue;
    (byDay[new Date(t).toISOString().slice(0, 10)] ||= []).push(price);
  }
  const days = Object.keys(byDay).sort().map((d) => [d, +median(byDay[d]).toPrecision(5), 0, byDay[d].length]);
  if (days.length < 10) throw new Error('chart empty');
  return days;
}
const PAGE = 100;      // the API may cap this lower; we advance by what it returns
const PARALLEL = 4;    // be gentle with Doggy Market

let testStore = null;
export const __setStore = (s) => { testStore = s; }; // tests only
export const store = () => testStore || getStore('dogi-history');

const empty = () => ({ v: 1, newest: null, oldest: null, offset: 0, complete: false, total: 0, days: {} });

export async function loadState() {
  const s = await store().get('state', { type: 'json' }).catch(() => null);
  return s && s.v === 1 ? s : empty();
}

async function page(offset, limit = PAGE) {
  const r = await fetch(`${API}?offset=${offset}&limit=${limit}&type=sell`, { headers: HEADERS });
  if (!r.ok) throw new Error('doggy.market ' + r.status);
  const d = await r.json();
  return { items: Array.isArray(d?.data) ? d.data : [], total: Number(d?.total) || 0 };
}

// one sale -> [timeMs, pricePerToken in DOGE, amount] or null
function sale(it) {
  if (!it || (it.status && it.status !== 'bought')) return null;
  const t = Date.parse(it.date);
  const ppt = Number(it.pricePerToken) / SHIBE;
  const amt = Number(it.amount);
  if (!isFinite(t) || !(ppt > 0) || !(amt > 0)) return null;
  return [t, ppt, amt];
}

function add(state, s) {
  const day = new Date(s[0]).toISOString().slice(0, 10);
  (state.days[day] ||= []).push([+s[1].toPrecision(6), s[2]]);
}

// Runs for at most `budgetMs`, saves progress, returns a short status.
export async function syncStep(budgetMs = 8000) {
  const t0 = Date.now();
  const state = await loadState();
  let added = 0;

  // 0) Doggy Market's chart data, when it lets us in
  try {
    state.chartDays = await chartDays();
    state.source = 'chart';
    state.updated = new Date().toISOString();
    await store().setJSON('state', state);
    return { source: 'chart', days: state.chartDays.length, ms: Date.now() - t0 };
  } catch (e) {
    state.source = 'sales';
    state.chartError = String(e.message || e);
  }

  // 1) newest sales since the last run (only after the first page exists)
  if (state.newest) {
    let off = 0, newestSeen = state.newest, done = false;
    while (!done && Date.now() - t0 < budgetMs / 3) {
      const { items, total } = await page(off);
      if (total) state.total = total;
      if (!items.length) break;
      for (const it of items) {
        const s = sale(it);
        if (!s) continue;
        if (s[0] <= state.newest) { done = true; break; }
        add(state, s); added++;
        if (s[0] > newestSeen) newestSeen = s[0];
      }
      off += items.length;
    }
    state.newest = newestSeen;
  }

  // learn how many items the API really returns per page (it may cap `limit`)
  if (!state.pageSize && !state.complete) {
    const { items, total } = await page(0);
    state.pageSize = Math.max(1, Math.min(PAGE, items.length || PAGE));
    if (total) state.total = total;
  }
  const size = state.pageSize || PAGE;

  // 2) backfill older sales, a few pages in parallel
  while (!state.complete && Date.now() - t0 < budgetMs) {
    const offs = Array.from({ length: PARALLEL }, (_, i) => state.offset + i * size);
    const pages = await Promise.all(offs.map((o) => page(o, size)));
    let got = 0;
    for (const { items, total } of pages) {
      if (total) state.total = total;
      got += items.length;
      for (const it of items) {
        const s = sale(it);
        if (!s) continue;
        // anything at or after the oldest sale we already have was already counted
        // (new sales push older ones to higher offsets, so we may see them twice)
        if (state.oldest != null && s[0] >= state.oldest) continue;
        add(state, s); added++;
        if (state.newest == null || s[0] > state.newest) state.newest = s[0];
        if (state.oldest == null || s[0] < state.oldest) state.oldest = s[0];
      }
      if (items.length < size) { state.complete = true; break; }
    }
    if (!got) { state.complete = true; break; }
    state.offset += got;
  }

  state.updated = new Date().toISOString();
  await store().setJSON('state', state);
  return { source: 'sales', chartError: state.chartError, added, complete: state.complete, offset: state.offset, total: state.total,
           oldest: state.oldest && new Date(state.oldest).toISOString(), ms: Date.now() - t0 };
}

function median(a) { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }

// Daily series: [day, median price in DOGE, DOGI traded, trades]
export function series(state) {
  if (state.source === 'chart' && Array.isArray(state.chartDays)) return state.chartDays;
  return Object.keys(state.days).sort().map((day) => {
    const rows = state.days[day];
    return [day, +median(rows.map((r) => r[0])).toPrecision(5), Math.round(rows.reduce((t, r) => t + r[1], 0)), rows.length];
  });
}

// ---- DOGE/USD daily close (Coinbase Exchange public candles, no key), cached 12 h ----
export async function dogeUsdRates() {
  const s = store();
  const cached = await s.get('dogeusd', { type: 'json' }).catch(() => null);
  if (cached && Date.now() - Date.parse(cached.updated) < 12 * 3600 * 1000) return cached.rates;
  const rates = { ...(cached?.rates || {}) };
  const DAY = 86400 * 1000, end = Date.now();
  // resume from the last known day (minus a few days), or from DOGI's first trades
  const known = Object.keys(rates).sort();
  let from = known.length ? Date.parse(known[known.length - 1]) - 5 * DAY : Date.parse('2023-03-01');
  while (from < end) {
    const to = Math.min(from + 290 * DAY, end);
    const u = `https://api.exchange.coinbase.com/products/DOGE-USD/candles?granularity=86400&start=${new Date(from).toISOString()}&end=${new Date(to).toISOString()}`;
    const r = await fetch(u, { headers: { 'User-Agent': 'dogidrc20.org (community site)', 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('coinbase ' + r.status);
    for (const c of await r.json()) {           // [time(s), low, high, open, close, volume]
      if (Array.isArray(c) && c[4] > 0) rates[new Date(c[0] * 1000).toISOString().slice(0, 10)] = +Number(c[4]).toPrecision(5);
    }
    from = to;
  }
  await s.setJSON('dogeusd', { updated: new Date().toISOString(), rates });
  return rates;
}
