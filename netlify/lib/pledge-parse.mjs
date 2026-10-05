// Parse "/pledge 5000 DOGE 5000 DOGI", "/pledge@Bot 5k doge + 2,500 dogi", "/pledge 5000 5000"
const MAX_DOGE = 100_000_000; // sanity caps
const MAX_DOGI = 21_000_000;

function num(s) {
  if (s == null) return null;
  let t = String(s).trim().toLowerCase().replace(/[\s_']/g, '');
  let mult = 1;
  if (t.endsWith('k')) { mult = 1e3; t = t.slice(0, -1); }
  else if (t.endsWith('m')) { mult = 1e6; t = t.slice(0, -1); }
  // "5,000" / "5.000" thousands separators vs "2.5" decimals
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * mult) : null;
}

export function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.trim().match(/^\/(pledge|unpledge|pledges)(?:@\w+)?\b(.*)$/is);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  if (cmd !== 'pledge') return { cmd };
  const rest = m[2].replace(/\+/g, ' ');
  const N = String.raw`(\d[\d.,'_ ]*?\s*[km]?)`;
  const dogeM = rest.match(new RegExp(N + String.raw`\s*(?:ð|Ð)?\s*doge\b`, 'i'));
  const dogiM = rest.match(new RegExp(N + String.raw`\s*dogi\b`, 'i'));
  let doge = dogeM ? num(dogeM[1]) : null;
  let dogi = dogiM ? num(dogiM[1]) : null;
  if (!dogeM && !dogiM) {
    const bare = rest.match(/\d[\d.,']*\s*[km]?/gi) || [];
    if (bare.length >= 1) doge = num(bare[0]);
    if (bare.length >= 2) dogi = num(bare[1]);
  }
  doge = doge || 0; dogi = dogi || 0;
  if (doge === 0 && dogi === 0) return { cmd: 'pledge', error: 'empty' };
  if (doge > MAX_DOGE || dogi > MAX_DOGI) return { cmd: 'pledge', error: 'too_big' };
  return { cmd: 'pledge', doge, dogi };
}
