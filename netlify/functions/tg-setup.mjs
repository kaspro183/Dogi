// GET /api/tg-setup?key=CRON_SECRET              -> lists the groups/channels the bot has been added to
// GET /api/tg-setup?key=CRON_SECRET&chat=<id>    -> picks that chat for buy alerts and sends a hello message
// GET /api/tg-setup?key=CRON_SECRET&webhook=1     -> turns on the /wallets command
import { botStore, tg, latestSales } from '../lib/telegram.mjs';

const json = (b, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const KEY = process.env.CRON_SECRET || process.env.DOGI_CRON_KEY;
  if (!KEY || q.get('key') !== KEY) return json({ error: 'forbidden' }, 403);
  if (!process.env.TELEGRAM_BOT_TOKEN) return json({ error: 'TELEGRAM_BOT_TOKEN missing' }, 500);
  const store = botStore();
  // &webhook=1 -> route bot commands (/wallets) to /api/tg-hook and show them in the "/" menu
  if (q.get('webhook') === '1') {
    await tg('setWebhook', { url: 'https://dogidrc20.org/api/tg-hook', secret_token: KEY, allowed_updates: ['message'], drop_pending_updates: true });
    await tg('setMyCommands', { commands: [{ command: 'wallets', description: 'Wallets that work with DOGI' }] });
    return json({ ok: true, note: 'webhook set: /wallets now answers in the group and in private' });
  }
  const chat = q.get('chat');
  if (chat) {
    await tg('sendMessage', { chat_id: chat, text: '🐕 DOGI Bot is connected! New DOGI buys on Doggy Market will be posted here.\n\nThe bot never DMs anyone and never asks for funds.' });
    const state = (await store.get('state', { type: 'json' }).catch(() => null)) || {};
    state.chatId = chat;
    // start watching from now, so the very next buy is announced
    if (state.lastTime == null) {
      const sales = await latestSales(30).catch(() => []);
      if (sales.length) { state.lastTime = sales[0].time; state.lastKeys = sales.filter((x) => x.time === sales[0].time).map((x) => x.key); }
      state.count = state.count || 0;
    }
    await store.setJSON('state', state);
    return json({ ok: true, chatId: chat, note: 'saved, alerts will go to this chat' });
  }
  const me = await tg('getMe', {});
  const updates = await tg('getUpdates', { allowed_updates: ['message', 'channel_post', 'my_chat_member'] });
  const chats = {};
  for (const u of updates) {
    const c = (u.my_chat_member || u.message || u.channel_post || {}).chat;
    if (c && c.type !== 'private') chats[c.id] = { id: c.id, title: c.title, type: c.type };
  }
  return json({ bot: '@' + me.username, chats: Object.values(chats),
    help: Object.keys(chats).length ? 'Open this same link again with &chat=<id> added at the end to choose the chat.' : 'No group found yet: add the bot to the group/channel (or remove and re-add it), then reload this page.' });
};

export const config = { path: '/api/tg-setup' };
