// Replies for the bot's slash commands: { text (HTML), buttons (inline keyboard rows) }
import { market } from './telegram.mjs';

const n = (x, d = 0) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const usd = (x) => x >= 1e6 ? '$' + (x / 1e6).toFixed(2) + 'M' : x >= 100 ? '$' + n(x) : x >= 1 ? '$' + n(x, 2) : '$' + n(x, 3);
const doge = (x) => x >= 1e6 ? (x / 1e6).toFixed(1) + 'M Ð' : n(x, x >= 10 ? 1 : 3) + ' Ð';
const BUY = [{ text: '🛒 Buy DOGI on Doggy Market', url: 'https://doggy.market/dogi' }];
const SAFE = '🔐 Never share your seed phrase. Admins never DM first.';

const WALLETS = {
  text: ['👛 <b>Wallets that work with DOGI</b>', '',
    '🦴 <b>Doggy Market wallet</b>: built-in, the easiest',
    '👻 <b>Spooky Doge</b>: Chrome · iPhone · Android',
    '🟡 <b>Doge Soft</b>: Chrome · Android',
    '🕹️ <b>Nintondo</b>: Chrome (may show a different address from the same 12 words)', '',
    '♻️ Old Doginals Wallet, Doge Labs or MyDoge? Import your seed phrase into one of these.', '', SAFE].join('\n'),
  buttons: [
    [{ text: '🦴 Doggy Market', url: 'https://doggy.market/dogi' }],
    [{ text: '👻 Spooky Doge · Chrome', url: 'https://chromewebstore.google.com/detail/spooky-doge/llefaokflckonkllgdflmboibglnbbac' },
     { text: '👻 Spooky Doge · iPhone', url: 'https://apps.apple.com/us/app/spookydoge/id6757091894' }],
    [{ text: '👻 Spooky Doge · Android', url: 'https://play.google.com/store/apps/details?id=xyz.spooksociety.wallet' }],
    [{ text: '🟡 Doge Soft · Chrome', url: 'https://chromewebstore.google.com/detail/doge-soft-wallet/mncnaalpffmdadokkpafllancebgjghf' },
     { text: '🟡 Doge Soft · Android', url: 'https://play.google.com/store/apps/details?id=com.dogecoin.dogesoftwallet' }],
    [{ text: '🕹️ Nintondo · Chrome', url: 'https://chromewebstore.google.com/detail/nintondo-wallet/akkmagafhjjjjclaejjomkeccmjhdkpa' }],
    [{ text: '📖 Full wallet guide', url: 'https://dogidrc20.org/buy.html' }],
  ],
};

async function price() {
  const m = await market();
  if (!m.floorDoge) return { text: 'Price data is unavailable right now, please try again in a minute.' };
  const u = (d) => (m.dogeUsd ? ` (~${usd(d * m.dogeUsd)})` : '');
  const ch = m.change7d == null ? '' : `\n📈 7 days: <b>${m.change7d >= 0 ? '▲ +' : '▼ '}${(m.change7d * 100).toFixed(1)}%</b>`;
  return {
    text: `💰 <b>DOGI price</b>\n\nFloor: <b>${doge(m.floorDoge)}</b>${u(m.floorDoge)}` +
      (m.lastDoge ? `\nLast sale: <b>${doge(m.lastDoge)}</b>${u(m.lastDoge)}` : '') + ch + '\n\n<i>Live data from Doggy Market</i>',
    buttons: [BUY],
  };
}

async function stats() {
  const m = await market();
  return {
    text: ['📊 <b>DOGI stats</b>', '',
      m.holders ? `👥 Holders: <b>${n(m.holders)}</b>` : null,
      m.mcapUsd ? `🏦 Market cap (at floor): <b>${usd(m.mcapUsd)}</b> (~${doge(m.mcapDoge)})` : null,
      m.listings ? `🏷️ Listings for sale: <b>${n(m.listings)}</b>` : null,
      '🪙 Supply: <b>21,000,000</b> (fully minted, no pre-mine)',
      '🥇 The first DRC-20 on Dogecoin · March 2023', '', '<i>Live data from Doggy Market</i>'].filter((l) => l !== null).join('\n'),
    buttons: [BUY],
  };
}

async function pledge() {
  const [pr, m] = await Promise.all([fetch('https://dogidrc20.org/api/pledges').then((r) => r.json()).catch(() => null), market()]);
  if (!pr || !Array.isArray(pr.pledges) || !m.lastDoge || !m.dogeUsd) return { text: 'Pledge data is unavailable right now, please try again in a minute.' };
  let tD = 0, tG = 0;
  for (const p of pr.pledges) { tD += Number(p.doge || 0); tG += Number(p.dogi || 0); }
  const total = (tD + tG * m.lastDoge) * m.dogeUsd, goal = Number(pr.goalUsd || 100000), pct = Math.min(100, (total / goal) * 100);
  const bar = '🟨'.repeat(Math.round(pct / 10)) + '⬛'.repeat(10 - Math.round(pct / 10));
  return {
    text: ['💧 <b>DOGI/DOGE pool pledges</b>', '',
      `<b>${usd(total)}</b> / ${usd(goal)} (${Math.round(pct)}%)`, bar, '',
      `${pr.pledges.length} pledges · ${n(tD)} DOGE + ${n(tG)} DOGI`, '',
      '⚠️ Pledges are intentions only: no funds are collected and nobody will ever ask you to send anything.'].join('\n'),
    buttons: [[{ text: '💧 Add your pledge', url: 'https://dogidrc20.org/pledge.html' }]],
  };
}

const BUYGUIDE = {
  text: ['🛒 <b>How to buy DOGI</b>', '',
    '1️⃣ Get a DRC-20 wallet (type /wallets)',
    '2️⃣ Send some DOGE to it',
    '3️⃣ Open DOGI on Doggy Market and buy a listing',
    '4️⃣ Your DOGI show up after the transaction confirms', '', SAFE].join('\n'),
  buttons: [BUY, [{ text: '📖 Step-by-step guide', url: 'https://dogidrc20.org/buy.html' }]],
};

const LINKS = {
  text: ['🔗 <b>Official DOGI links</b>', '',
    '🌐 Website: dogidrc20.org',
    '𝕏 X: @DogiDrc20',
    '✈️ Telegram: t.me/dogi_doginals_drc20',
    '🦴 Trade: doggy.market/dogi', '',
    '🚨 Only trust these links. Admins never DM first and nobody official will ever ask for your seed phrase or funds.'].join('\n'),
  buttons: [
    [{ text: '🌐 Website', url: 'https://dogidrc20.org' }, { text: '𝕏 X', url: 'https://x.com/DogiDrc20' }],
    [{ text: '🦴 Doggy Market', url: 'https://doggy.market/dogi' }],
  ],
};

const TESTNET = {
  text: ['🧪 <b>Swap DOGI on DogeOS Testnet</b>', '',
    '⚠️ Testnet only: test tokens have NO real value. Never use real funds.',
    'ℹ️ Test DOGI has a 1 billion supply, for testing only. Real DOGI = 21 million.', '',
    '1️⃣ Add DogeOS to MetaMask (portal → "Add to MetaMask")',
    '2️⃣ Claim free test DOGE on the faucet',
    '3️⃣ Import test DOGI in MetaMask:',
    '<code>0xF88599E8881e3133176D4F7937204c7A8bDB5776</code>',
    '4️⃣ Swap DOGE → DOGI on the BarkSwap pool'].join('\n'),
  buttons: [
    [{ text: '1️⃣ DogeOS portal', url: 'https://portal.testnet.dogeos.com' }, { text: '2️⃣ Faucet', url: 'https://faucet.testnet.dogeos.com' }],
    [{ text: '3️⃣ Test DOGI on Laika', url: 'https://testnet.laika.market/tokens?address=0xF88599E8881e3133176D4F7937204c7A8bDB5776' }],
    [{ text: '4️⃣ BarkSwap pool', url: 'https://www.barkswap.fi/pool/0x6c99d03236c57bc0810e28477a649f151aa1bf9d' }],
  ],
};

export const COMMANDS = {
  price: { description: 'DOGI floor, last sale and 7-day change', run: price },
  stats: { description: 'Holders, market cap and listings', run: stats },
  pledge: { description: 'Liquidity pledges for the DOGI/DOGE pool', run: pledge },
  buy: { description: 'How to buy DOGI', run: async () => BUYGUIDE },
  wallets: { description: 'Wallets that work with DOGI', run: async () => WALLETS },
  links: { description: 'Official DOGI links', run: async () => LINKS },
  testnet: { description: 'Try DOGI on the DogeOS testnet', run: async () => TESTNET },
};
