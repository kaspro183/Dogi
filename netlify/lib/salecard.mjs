// Renders the "NEW BUY" card (1200x600 PNG) for one DOGI sale.
// satori lays out the card as SVG, resvg (wasm) turns it into a PNG. Assets live in netlify/lib/card/.
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// find netlify/lib/card both locally and inside the Netlify function bundle
function cardDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const d of [join(here, 'card'), join(here, '../lib/card'), join(process.cwd(), 'netlify/lib/card'), '/var/task/netlify/lib/card']) {
    if (existsSync(join(d, 'logo.png'))) return d;
  }
  throw new Error('card assets not found');
}

let ready = null;
function assets() {
  if (ready) return ready;
  const d = cardDir(), f = (n) => readFileSync(join(d, n));
  ready = (async () => {
    await initWasm(f('resvg.wasm'));
    return {
      fonts: [
        { name: 'SG', data: f('space-grotesk-latin-500-normal.woff'), weight: 500, style: 'normal' },
        { name: 'SG', data: f('space-grotesk-latin-700-normal.woff'), weight: 700, style: 'normal' },
        { name: 'JB', data: f('jetbrains-mono-latin-600-normal.woff'), weight: 600, style: 'normal' },
      ],
      logo: 'data:image/png;base64,' + f('logo.png').toString('base64'),
      emoji: Object.fromEntries(['1f990', '1f41f', '1f42c', '1f433'].map((c) => [c, 'data:image/svg+xml;base64,' + f(c + '.svg').toString('base64')])),
    };
  })();
  return ready;
}

// size tiers (DOGI bought)
export function tier(amount) {
  if (amount >= 10000) return { name: 'WHALE', code: '1f433', icon: '🐳' };
  if (amount >= 2000) return { name: 'DOLPHIN', code: '1f42c', icon: '🐬' };
  if (amount >= 500) return { name: 'FISH', code: '1f41f', icon: '🐟' };
  return { name: 'SHRIMP', code: '1f990', icon: '🦐' };
}

const h = (type, style, ...children) => ({ type, props: { style, children: children.length <= 1 ? children[0] : children } });
const img = (src, w, hgt, style = {}) => ({ type: 'img', props: { src, width: w, height: hgt, style } });
const n = (x, d = 0) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const usd = (x) => x >= 100 ? '$' + n(x) : x >= 1 ? '$' + n(x, 2) : '$' + n(x, x >= 0.01 ? 3 : 4);
const compactUsd = (x) => x >= 1e6 ? '$' + (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? '$' + (x / 1e3).toFixed(1) + 'K' : usd(x);
const short = (a) => a ? a.slice(0, 5) + '…' + a.slice(-3) : '—';

const GOLD = '#f5c400', TEXT = '#f4ecd9', MUTED = '#a99f88', CARD = '#1b170f', LINE = '#2e2718';

function row(label, value, sub, hl) {
  return h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: hl ? 'rgba(245,196,0,0.08)' : CARD,
      border: `1.5px solid ${hl ? 'rgba(245,196,0,0.6)' : LINE}`, borderRadius: 18, padding: '14px 22px' },
    h('div', { fontFamily: 'JB', fontSize: 22, letterSpacing: 5, color: MUTED }, label),
    h('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
      h('div', { fontSize: 40, fontWeight: 700, letterSpacing: -1, color: hl ? GOLD : TEXT, lineHeight: 1.05 }, value),
      ...(sub ? [h('div', { fontSize: 20, color: MUTED }, sub)] : [])));
}
function mini(label, value) {
  return h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, background: CARD, border: `1.5px solid ${LINE}`, borderRadius: 16, padding: '10px 8px' },
    h('div', { fontFamily: 'JB', fontSize: 14, letterSpacing: 3, color: MUTED }, label),
    h('div', { fontSize: 22, fontWeight: 700, color: TEXT }, value));
}

// sale = { n, amount, totalDoge, buyer }, market = { dogeUsd, holders, mcapUsd }
export async function renderCard(sale, market) {
  const a = await assets();
  const t = tier(sale.amount);
  const ppt = sale.totalDoge / sale.amount, du = market.dogeUsd;
  const tree = h('div', { width: 1200, height: 600, display: 'flex', background: '#000', fontFamily: 'SG', color: TEXT },
    h('div', { display: 'flex', width: 1200, height: 600, borderRadius: 36, overflow: 'hidden', background: '#0d0b08' },
      // left: logo
      h('div', { width: 430, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative',
          backgroundImage: 'radial-gradient(circle at 40% 35%, #ffdb4d, #f5c400 55%, #d9a800)', color: '#1c1302' },
        h('div', { position: 'absolute', left: 28, top: 24, fontFamily: 'JB', fontSize: 24 }, '#' + sale.n),
        img(a.logo, 250, 250, { borderRadius: 125 }),
        h('div', { fontSize: 76, fontWeight: 700, marginTop: 14 }, '$DOGI'),
        h('div', { position: 'absolute', bottom: 22, fontFamily: 'JB', fontSize: 17, opacity: 0.75 }, 't.me/dogi_doginals_drc20')),
      // middle: numbers
      h('div', { flex: 1, display: 'flex', flexDirection: 'column', padding: '26px 24px', gap: 14, backgroundImage: 'linear-gradient(180deg, #15120c, #0d0b08)' },
        row('BOUGHT', n(sale.amount) + ' DOGI', null, true),
        row('PAID', n(sale.totalDoge) + ' Ð', du ? '~ ' + usd(sale.totalDoge * du) : null),
        row('PRICE', n(ppt, 2) + ' Ð', du ? '~ ' + usd(ppt * du) + ' / DOGI' : null),
        h('div', { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, background: 'rgba(245,196,0,0.06)',
            border: '1.5px dashed rgba(245,196,0,0.35)', borderRadius: 18 },
          img(a.emoji[t.code], 96, 96),
          h('div', { fontFamily: 'JB', fontSize: 44, letterSpacing: 10, color: GOLD }, t.name)),
        h('div', { display: 'flex', gap: 12 },
          mini('BUYER', short(sale.buyer)),
          mini('MCAP', market.mcapUsd ? compactUsd(market.mcapUsd) : '—'),
          mini('HOLDERS', market.holders ? n(market.holders) : '—'),
          mini('SUPPLY', '21M'))),
      // right: vertical band
      h('div', { width: 70, background: GOLD, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 },
        ...'NEW BUY'.split('').map((c) => h('div', { fontFamily: 'JB', fontSize: 26, color: '#1c1302', height: c === ' ' ? 14 : 30 }, c === ' ' ? '' : c)))));
  const svg = await satori(tree, { width: 1200, height: 600, fonts: a.fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
