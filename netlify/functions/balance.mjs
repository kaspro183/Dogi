// GET /api/balance?address=D...&offset=0 -> DOGI balance + DOGI activity of one Dogecoin address, from Doggy Market.
// { address, balance: { total, available, inscribed }, floorDoge, history: [{ type, amount, from, to, time, tx }], historyTotal, next }
// Read-only: only a public address is ever sent. Nothing is stored. Cached 60 s per address at the edge.
// Sources (the same calls doggy.market's own address page makes):
//   /wallet/{addr}/holdings              -> [{ tick, total, available, inscribed, token: { floorPrice (shibes) } }, ...]
//   /wallet/{addr}/activity?offset&limit -> { data: [{ type: 'transfer'|'inscribe-transfer'|..., tick, amt, from, to, address, transferedAt|inscribedAt, tx }], total }
const API = 'https://api.doggy.market/wallet/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (DOGI community site)',
  'Accept': 'application/json',
  'Origin': 'https://doggy.market',
  'Referer': 'https://doggy.market/',
};
const ADDR = /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const PAGE = 50;      // activity items per Doggy Market call (all tokens mixed)
const PAGES = 3;      // calls per request -> up to 150 activity items scanned for DOGI
const getJson = async (url) => {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error('doggy.market ' + r.status);
  return r.json();
};
const json = (body, status = 200, cdn = 'no-store') => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': cdn },
});

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const address = (q.get('address') || '').trim();
  const offset = Math.max(0, parseInt(q.get('offset') || '0', 10) || 0);
  if (!ADDR.test(address)) return json({ error: 'invalid address' }, 400);
  const base = API + encodeURIComponent(address);
  try {
    const calls = [offset === 0 ? getJson(base + '/holdings') : Promise.resolve(null)];
    for (let i = 0; i < PAGES; i++) calls.push(getJson(`${base}/activity?offset=${offset + i * PAGE}&limit=${PAGE}`).catch(() => null));
    const [holdings, ...pages] = await Promise.all(calls);

    let balance, floorDoge = null;
    if (holdings) {
      const row = (Array.isArray(holdings) ? holdings : []).find((h) => String(h?.tick).toLowerCase() === 'dogi');
      balance = { total: Number(row?.total) || 0, available: Number(row?.available) || 0, inscribed: Number(row?.inscribed) || 0 };
      if (row?.token?.floorPrice > 0) floorDoge = row.token.floorPrice / 1e8;
    }

    let total = 0, scanned = 0;
    const history = [];
    for (const p of pages) {
      if (!p) break;
      total = Number(p.total) || total;
      const list = Array.isArray(p.data) ? p.data : [];
      scanned += list.length;
      for (const it of list) {
        if (String(it?.tick).toLowerCase() !== 'dogi') continue;
        const time = it.transferedAt || it.inscribedAt || it.createdAt || it.date;
        if (!time) continue;
        history.push({ type: it.type || '', amount: Number(it.amt) || 0, from: it.from || null, to: it.to || null, time, tx: it.tx || null });
      }
      if (list.length < PAGE) break;
    }
    const next = offset + scanned < total ? offset + scanned : null;
    return json({ address, balance, floorDoge, history, historyTotal: total, next, fetchedAt: new Date().toISOString() },
      200, 'public, s-maxage=60');
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};

export const config = { path: '/api/balance' };
