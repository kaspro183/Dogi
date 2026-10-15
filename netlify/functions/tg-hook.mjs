// POST /api/tg-hook  <- Telegram webhook for @DogiDrc20Bot commands.
// Only /wallets is handled; everything else is ignored. Telegram signs each call with
// the secret_token set in setWebhook (same value as DOGI_CRON_KEY / CRON_SECRET).
import { tg } from '../lib/telegram.mjs';

const ok = () => new Response('ok');

const WALLETS_TEXT = [
  '👛 <b>Wallets that work with DOGI</b>',
  '',
  '🦴 <b>Doggy Market wallet</b>: built-in, the easiest',
  '👻 <b>Spooky Doge</b>: Chrome · iPhone',
  '🟡 <b>Doge Soft</b>: Chrome · Android',
  '',
  '♻️ Old Doginals Wallet, Doge Labs or MyDoge? Import your seed phrase into one of these.',
  '',
  '🔐 Never share your seed phrase. Admins never DM first.',
].join('\n');

const WALLETS_BUTTONS = [
  [{ text: '🦴 Doggy Market', url: 'https://doggy.market/dogi' }],
  [{ text: '👻 Spooky Doge · Chrome', url: 'https://chromewebstore.google.com/detail/spooky-doge/llefaokflckonkllgdflmboibglnbbac' },
   { text: '👻 Spooky Doge · iPhone', url: 'https://apps.apple.com/us/app/spookydoge/id6757091894' }],
  [{ text: '🟡 Doge Soft · Chrome', url: 'https://chromewebstore.google.com/detail/doge-soft-wallet/mncnaalpffmdadokkpafllancebgjghf' },
   { text: '🟡 Doge Soft · Android', url: 'https://play.google.com/store/apps/details?id=com.dogecoin.dogesoftwallet' }],
];

export default async (req) => {
  const KEY = process.env.CRON_SECRET || process.env.DOGI_CRON_KEY;
  if (req.method !== 'POST' || !KEY || req.headers.get('x-telegram-bot-api-secret-token') !== KEY) return new Response('forbidden', { status: 403 });
  const u = await req.json().catch(() => null);
  const msg = u && (u.message || u.channel_post);
  const text = (msg && msg.text) || '';
  // "/wallets" or "/wallets@DogiDrc20Bot", optionally followed by words
  const cmd = text.trim().split(/\s+/)[0].toLowerCase();
  if (cmd === '/wallets' || cmd.startsWith('/wallets@')) {
    try {
      await tg('sendMessage', {
        chat_id: msg.chat.id, text: WALLETS_TEXT, parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: { inline_keyboard: WALLETS_BUTTONS },
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
      });
    } catch (e) { console.log('wallets reply failed', String(e.message || e)); }
  }
  return ok();   // always 200 so Telegram doesn't retry
};

export const config = { path: '/api/tg-hook' };
