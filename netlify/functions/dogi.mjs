// Netlify Function: serves /api/dogi
// Fetches DOGI stats + recent sales from Doggy Market (server-side, no CORS issue)
// and the DOGE/USD rate, then returns one JSON payload. Cached at the edge for 5 min.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (DOGI community site)',
  'Accept': 'application/json',
  'Origin': 'https://doggy.market',
  'Referer': 'https://doggy.market/dogi',
};

// Candidate endpoints for the DOGI activity feed, tried in order.
const ACTIVITY_URLS = [
  'https://api.doggy.market/token/dogi/activity?offset=0&limit=20',
  'https://api.doggy.market/token/dogi/activity',
  'https://api.doggy.market/activity/drc/dogi?offset=0&limit=20',
];

const getJson = async (url) => {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
};

const SHIBE = 1e8;
const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return null; };
const toDoge = (v) => { const n = Number(v); if (!isFinite(n)) return null; return n > 1e5 ? n / SHIBE : n; };

function findList(d) {
  if (Array.isArray(d)) return d;
  for (const k of ['data', 'items', 'activity', 'activities', 'list', 'results', 'rows', 'trades', 'sales']) {
    if (Array.isArray(d?.[k])) return d[k];
    if (d?.[k] && typeof d[k] === 'object') { const inner = findList(d[k]); if (inner) return inner; }
  }
  return null;
}

// Map one activity item (exact shape unknown) to { amount, total, from, to, inscription, time }
function normalize(it) {
  const type = String(pick(it, ['type', 'action', 'event', 'kind', 'op']) || '').toLowerCase();
  if (type && !/(sell|sale|sold|buy|bought|trade|match)/.test(type)) return null;
  const amount = Number(pick(it, ['amount', 'amt', 'quantity', 'qty']));
  let total = toDoge(pick(it, ['price', 'totalPrice', 'total', 'value', 'priceTotal']));
  const unit = toDoge(pick(it, ['unitPrice', 'pricePerToken', 'pricePerUnit']));
  if ((total == null || !isFinite(total)) && unit != null && amount) total = unit * amount;
  const from = pick(it, ['from', 'seller', 'sellerAddress', 'fromAddress', 'maker']);
  const to = pick(it, ['to', 'buyer', 'buyerAddress', 'toAddress', 'taker']);
  const inscription = pick(it, ['inscriptionNumber', 'number', 'inscriptionNum', 'inscription_number']);
  let time = pick(it, ['createdAt', 'timestamp', 'time', 'date', 'blockTime', 'created_at']);
  if (typeof time === 'number' && time < 1e12) time *= 1000;
  if (!amount || total == null || !time) return null;
  return { amount, total, from, to, inscription, time: new Date(time).toISOString() };
}

async function getSales() {
  const tried = [];
  for (const url of ACTIVITY_URLS) {
    try {
      const d = await getJson(url);
      const list = findList(d) || [];
      const sales = list.map(normalize).filter(Boolean).slice(0, 5);
      tried.push({ url, ok: true, items: list.length, keys: list[0] ? Object.keys(list[0]) : [], first: list[0] || null });
      if (sales.length) return { sales, tried };
    } catch (e) {
      tried.push({ url, ok: false, error: String(e.message || e) });
    }
  }
  return { sales: [], tried };
}

export default async (req) => {
  const debug = new URL(req.url).searchParams.has('debug');
  try {
    const [tokRes, dogeRes, salesRes] = await Promise.allSettled([
      getJson('https://api.doggy.market/token/dogi'),
      getJson('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd'),
      getSales(),
    ]);
    if (tokRes.status !== 'fulfilled') throw new Error('doggy.market unavailable');
    const dogeUsd = dogeRes.status === 'fulfilled' ? (dogeRes.value?.dogecoin?.usd ?? null) : null;
    const s = salesRes.status === 'fulfilled' ? salesRes.value : { sales: [], tried: [] };
    const body = { token: tokRes.value, dogeUsd, sales: s.sales, fetchedAt: new Date().toISOString() };
    if (debug) body.salesDebug = s.tried;
    return new Response(JSON.stringify(body), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': debug ? 'no-store' : 'public, max-age=60',
        'Netlify-CDN-Cache-Control': debug ? 'no-store' : 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const config = { path: '/api/dogi' };
