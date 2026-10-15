// POST /api/tg-hook  <- Telegram webhook for @DogiDrc20Bot slash commands (see lib/commands.mjs).
// Anything that isn't a known command is ignored. Telegram signs each call with the
// secret_token set in setWebhook (same value as DOGI_CRON_KEY / CRON_SECRET).
import { tg } from '../lib/telegram.mjs';
import { COMMANDS } from '../lib/commands.mjs';

export default async (req) => {
  const KEY = process.env.CRON_SECRET || process.env.DOGI_CRON_KEY;
  if (req.method !== 'POST' || !KEY || req.headers.get('x-telegram-bot-api-secret-token') !== KEY) return new Response('forbidden', { status: 403 });
  const u = await req.json().catch(() => null);
  const msg = u && u.message;
  const first = ((msg && msg.text) || '').trim().split(/\s+/)[0].toLowerCase();
  // "/price" or "/price@DogiDrc20Bot"
  const m = first.match(/^\/([a-z]+)(?:@(\w+))?$/);
  const cmd = m && COMMANDS[m[1]];
  if (cmd && (!m[2] || m[2] === 'dogidrc20bot')) {
    try {
      const r = await cmd.run();
      await tg('sendMessage', {
        chat_id: msg.chat.id, text: r.text, parse_mode: 'HTML', disable_web_page_preview: true,
        ...(r.buttons ? { reply_markup: { inline_keyboard: r.buttons } } : {}),
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
      });
    } catch (e) { console.log('command failed', m[1], String(e.message || e)); }
  }
  return new Response('ok');   // always 200 so Telegram doesn't retry
};

export const config = { path: '/api/tg-hook' };
