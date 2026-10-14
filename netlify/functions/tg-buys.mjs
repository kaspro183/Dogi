// GET /api/tg-buys?key=CRON_SECRET  -> posts every new DOGI sale from Doggy Market to Telegram as a "NEW BUY" card.
// Called every few minutes by a timer (GitHub Actions). Nothing changes on the website itself.
//   &test=1  -> re-posts the most recent sale (to check the setup), without touching the saved state
// State in Netlify Blobs (store "dogi-bot", key "state"): { chatId, lastTime, lastKeys, count }
import { botStore, latestSales, market, sendPhoto } from '../lib/telegram.mjs';
import { renderCard } from '../lib/salecard.mjs';

const MAX_PER_RUN = 5;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const KEY = process.env.CRON_SECRET || process.env.DOGI_CRON_KEY;
  if (!KEY || q.get('key') !== KEY) return json({ error: 'forbidden' }, 403);
  if (!process.env.TELEGRAM_BOT_TOKEN) return json({ error: 'TELEGRAM_BOT_TOKEN missing' }, 500);
  const store = botStore();
  const state = (await store.get('state', { type: 'json' }).catch(() => null)) || {};
  const chatId = process.env.TELEGRAM_CHAT_ID || state.chatId;
  if (!chatId) return json({ error: 'no chat yet: open /api/tg-setup first' }, 409);

  const sales = await latestSales(30);
  if (!sales.length) return json({ ok: true, posted: 0, note: 'no sales returned' });
  const test = q.get('test') === '1';

  let fresh;
  if (test) fresh = [sales[0]];
  else if (state.lastTime == null) {                       // first run: remember where we are, post nothing
    state.lastTime = sales[0].time; state.lastKeys = sales.filter((s) => s.time === sales[0].time).map((s) => s.key);
    state.count = state.count || 0;
    await store.setJSON('state', state);
    return json({ ok: true, posted: 0, note: 'initialised, alerts start with the next sale' });
  } else {
    const seen = new Set(state.lastKeys || []);
    fresh = sales.filter((s) => s.time > state.lastTime || (s.time === state.lastTime && !seen.has(s.key)));
  }
  if (!fresh.length) return json({ ok: true, posted: 0 });

  fresh.sort((a, b) => a.time - b.time);                   // oldest first, so the group reads them in order
  const skipped = Math.max(0, fresh.length - MAX_PER_RUN);
  const toPost = fresh.slice(-MAX_PER_RUN);
  const m = await market();
  let posted = 0, count = state.count || 0;
  const errors = [];
  for (const s of toPost) {
    const num = test ? count : ++count;
    try {
      const png = await renderCard({ n: num || 1, amount: s.amount, totalDoge: s.totalDoge, buyer: s.buyer }, m);
      await sendPhoto(chatId, png, null, [[{ text: '🛒 Buy DOGI on Doggy Market', url: 'https://doggy.market/dogi' }]]);
      posted++;
    } catch (e) { errors.push(String(e.message || e)); }
  }
  if (!test) {
    const newest = fresh[fresh.length - 1].time;
    state.lastTime = newest;
    state.lastKeys = sales.filter((s) => s.time === newest).map((s) => s.key);
    state.count = count;
    await store.setJSON('state', state);
  }
  return json({ ok: errors.length === 0, posted, skipped, errors: errors.length ? errors : undefined });
};

export const config = { path: '/api/tg-buys' };
