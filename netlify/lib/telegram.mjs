// Telegram helpers + DOGI sales feed for the buy-alert bot.
import { getStore } from '@netlify/blobs';

let testStore = null;
export const __setBotStore = (s) => { testStore = s; }; // tests only
export const botStore = () => testStore || getStore('dogi-bot');
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const api = (m) => `https://api.telegram.org/bot${TOKEN()}/${m}`;

export async function tg(method, body) {
  const r = await fetch(api(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram ${method}: ${j.description || r.status}`);
  return j.result;
}

export async function sendPhoto(chatId, png, caption, buttons) {
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'dogi-buy.png');
  if (caption) { fd.append('caption', caption); fd.append('parse_mode', 'HTML'); }
  if (buttons) fd.append('reply_markup', JSON.stringify({ inline_keyboard: buttons }));
  const r = await fetch(api('sendPhoto'), { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error('telegram sendPhoto: ' + (j.description || r.status));
  return j.result;
}

// ---- Doggy Market data (same endpoints the site already uses) ----
const DM = { 'User-Agent': 'Mozilla/5.0 (DOGI community site)', 'Accept': 'application/json', 'Origin': 'https://doggy.market', 'Referer': 'https://doggy.market/dogi' };
const getJson = async (u, headers = DM) => { const r = await fetch(u, { headers }); if (!r.ok) throw new Error(u + ' -> ' + r.status); return r.json(); };
const pick = (o, ks) => { for (const k of ks) if (o && o[k] != null && o[k] !== '') return o[k]; return null; };
const SHIBE = 1e8;

// newest completed DOGI sales first: [{ key, time(ms), amount, totalDoge, buyer }]
export async function latestSales(limit = 30) {
  const d = await getJson(`https://api.doggy.market/listings/tick/dogi/orders?offset=0&limit=${limit}&type=sell`);
  const list = Array.isArray(d?.data) ? d.data : [];
  return list.map((it) => {
    if (it?.status && it.status !== 'bought') return null;
    const amount = Number(pick(it, ['amount', 'amt']));
    let unit = Number(pick(it, ['pricePerToken', 'unitPrice']));
    let total = Number(pick(it, ['price', 'totalPrice', 'total']));
    unit = unit > 0 ? unit / SHIBE : 0;
    total = total > 0 ? (total > 1e5 ? total / SHIBE : total) : unit * amount;
    if (!(unit > 0) && total > 0 && amount) unit = total / amount;
    if (!(total > 0) || !(amount > 0)) return null;
    // keep total consistent with the unit price shown on Doggy Market
    if (unit > 0) total = unit * amount;
    const time = Date.parse(pick(it, ['date', 'updatedAt', 'createdAt']) || '');
    if (!isFinite(time)) return null;
    const buyer = pick(it, ['buyer', 'buyerAddress', 'to', 'toAddress', 'taker']);
    const id = pick(it, ['_id', 'id', 'inscriptionId', 'txid', 'tx']);
    return { key: String(id || `${time}|${amount}|${buyer}`), time, amount, totalDoge: total, buyer: typeof buyer === 'string' ? buyer : null };
  }).filter(Boolean);
}

export async function market() {
  const [tok, cg] = await Promise.allSettled([
    getJson('https://api.doggy.market/token/dogi'),
    getJson('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd', { Accept: 'application/json' }),
  ]);
  const t = tok.status === 'fulfilled' ? tok.value : {};
  const dogeUsd = cg.status === 'fulfilled' ? cg.value?.dogecoin?.usd ?? null : null;
  const floor = Number(t.floorPrice) / SHIBE;
  return { dogeUsd, holders: Number(t.holders) || null, mcapUsd: floor > 0 && dogeUsd ? floor * 21e6 * dogeUsd : null };
}
