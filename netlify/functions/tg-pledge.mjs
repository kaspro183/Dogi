// Telegram webhook: /pledge, /unpledge, /pledges in the DOGI group.
// Env: TG_BOT_TOKEN, TG_WEBHOOK_SECRET, optional TG_CHAT (default dogi_doginals_drc20)
import { getStore } from '@netlify/blobs';
import { parseCommand } from '../lib/pledge-parse.mjs';

const ok = () => new Response('ok');
const fmt = (n) => Number(n).toLocaleString('en-US');

async function reply(chatId, replyTo, text) {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: replyTo, allow_sending_without_reply: true, disable_web_page_preview: true }),
  }).catch(() => {});
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = process.env.TG_WEBHOOK_SECRET;
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response('forbidden', { status: 403 });

  let update; try { update = await req.json(); } catch { return ok(); }
  const site = new URL(req.url).origin;
  const msg = update.message;
  if (!msg || !msg.text || !msg.from || msg.from.is_bot) return ok();

  const allowed = (process.env.TG_CHAT || 'dogi_doginals_drc20').toLowerCase().replace(/^@/, '');
  const chatOk = msg.chat && (String(msg.chat.username || '').toLowerCase() === allowed || String(msg.chat.id) === allowed);
  const parsed = parseCommand(msg.text);
  if (!parsed) return ok();
  if (!chatOk) {
    if (msg.chat?.type === 'private') await reply(msg.chat.id, msg.message_id, 'Pledges only count when posted in the DOGI Telegram group: https://t.me/dogi_doginals_drc20');
    return ok();
  }

  const store = getStore('pledges');
  const key = `u${msg.from.id}`;
  const name = msg.from.username ? '@' + msg.from.username : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ').slice(0, 40) || 'anon';

  if (parsed.cmd === 'unpledge') {
    await store.delete(key);
    await reply(msg.chat.id, msg.message_id, `🗑 Pledge removed for ${name}.`);
    return ok();
  }
  if (parsed.cmd === 'pledges') {
    const { blobs } = await store.list();
    await reply(msg.chat.id, msg.message_id, `📊 ${blobs.length} pledge(s) so far. Full tracker: ${site}/pledge.html`);
    return ok();
  }
  if (parsed.error === 'empty') {
    await reply(msg.chat.id, msg.message_id, 'Format: /pledge 5000 DOGE 5000 DOGI\n(you can pledge only DOGE or only DOGI too)');
    return ok();
  }
  if (parsed.error === 'too_big') {
    await reply(msg.chat.id, msg.message_id, 'That amount looks too big. Max 100,000,000 DOGE and 21,000,000 DOGI.');
    return ok();
  }
  const existing = await store.get(key, { type: 'json' }).catch(() => null);
  const now = new Date().toISOString();
  await store.setJSON(key, { name, doge: parsed.doge, dogi: parsed.dogi, date: existing?.date || now, updated: now });
  await reply(msg.chat.id, msg.message_id,
    `✅ Pledge ${existing ? 'updated' : 'recorded'} for ${name}: ${fmt(parsed.doge)} DOGE + ${fmt(parsed.dogi)} DOGI\n` +
    `This is a public intention only. Nobody will ever ask you to send funds.\nTracker: ${site}/pledge.html`);
  return ok();
};

export const config = { path: '/api/tg-pledge' };
