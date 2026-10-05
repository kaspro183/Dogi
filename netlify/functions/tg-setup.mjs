// One-time setup: open /api/tg-setup?key=<TG_WEBHOOK_SECRET> once after adding the env vars.
// Registers the webhook (commands only) and the /pledge command menu.
export default async (req) => {
  const url = new URL(req.url);
  const secret = process.env.TG_WEBHOOK_SECRET, token = process.env.TG_BOT_TOKEN;
  if (!secret || !token) return new Response('Missing TG_BOT_TOKEN or TG_WEBHOOK_SECRET in Netlify env vars (then redeploy).', { status: 500 });
  if (url.searchParams.get('key') !== secret) return new Response('forbidden', { status: 403 });
  const api = (m, body) => fetch(`https://api.telegram.org/bot${token}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const hook = await api('setWebhook', { url: `${url.origin}/api/tg-pledge`, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });
  const cmds = await api('setMyCommands', { commands: [
    { command: 'pledge', description: 'Pledge liquidity: /pledge 5000 DOGE 5000 DOGI' },
    { command: 'unpledge', description: 'Remove your pledge' },
    { command: 'pledges', description: 'Show the pledge tracker' },
  ] });
  const me = await api('getMe', {});
  return new Response(JSON.stringify({ webhook: hook, commands: cmds, bot: me?.result?.username }, null, 2), { headers: { 'Content-Type': 'application/json' } });
};

export const config = { path: '/api/tg-setup' };
