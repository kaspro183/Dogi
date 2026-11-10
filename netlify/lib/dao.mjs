// DOGI DAO Watch: DOGI DAO proposals for the /dao.html page (via /api/dao), the bot's /dao command,
// and the Telegram alerts in tg-buys (new proposal open for votes, vote result).
//
// Source: Laika's proposals API (the same one testnet.laika.market uses), read automatically.
// If it can't be reached (or LAIKA_PROPOSALS_URL is empty), the MANUAL list below is used instead.
//
// Rules on testnet (from Laika): votes = veDOGI (locked DOGI, up to 3x for the longest lock);
// a proposal passes when more veDOGI votes For than Against and at least 4% of all veDOGI has voted.

export const DAO_URL = 'https://testnet.laika.market/tokens?address=0xF88599E8881e3133176D4F7937204c7A8bDB5776&view=dao';
export const NETWORK = 'DogeOS testnet';

// Laika endpoint, without the "?status=..." part. Can be overridden with the DAO_API_URL env var.
export const LAIKA_PROPOSALS_URL = '';

// Only proposals from these addresses are shown and announced: on testnet anyone can create a proposal,
// so this keeps random/spam proposals off the site and out of the Telegram group.
export const OFFICIAL_PROPOSERS = [
  '0x5dd596551214c33ae520afd66546e088a4a0b0b1',
  '0xfb1525e16fda109a5180a3ec23a7146b870e045b',
];

// Fallback when Laika can't be reached. num = the proposal number shown on Laika.
// status: 'live' | 'passed' | 'executed' | 'failed' | 'canceled' | 'ended'
const MANUAL = [
  { id: 'laika-7', num: 7, title: 'Advisory Proposal: Should 1% of Every Bridged DOGI Go to the DOGI DAO Treasury?', status: 'executed', opened: '2026-10-26T03:58:25Z', endsAt: '2026-11-02T03:58:25Z', result: '100% FOR · 6 voters' },
  { id: 'laika-6', num: 6, title: 'Reward stakers: Should the DOGI DAO distribute 1M DOGI (testnet tokens) from its treasury to DOGI stakers?', status: 'passed', opened: '2026-10-26T03:43:49Z', endsAt: '2026-10-31T03:43:49Z', result: '100% FOR · 7 voters · awaiting execution' },
];

// ---- reading Laika ----
const big = (x) => { try { return BigInt(String(x || '0').split('.')[0]); } catch { return 0n; } };
const ve = (wei) => { const n = Number(wei / 10n ** 15n) / 1000; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0); };

export function mapProposal(r) {
  const forV = big(r.forVotes), against = big(r.againstVotes), total = big(r.totalVotes) || forV + against;
  const pctFor = total > 0n ? Number((forV * 1000n) / total) / 10 : null;
  const voters = Number(r.voteCount) || 0;
  let status = String(r.status || '').toLowerCase();
  if (r.isActive || status === 'active') status = 'live';
  else if (r.canceled || status === 'canceled' || status === 'cancelled') status = 'canceled';
  else if (r.executed || status === 'executed') status = 'executed';
  else if (status === 'passed' || r.passed === true) status = 'passed';
  else if (status === 'failed' || status === 'defeated' || r.passed === false) status = 'failed';
  else status = 'ended';
  const votes = total > 0n ? `${pctFor}% FOR · ${voters} voter${voters === 1 ? '' : 's'} · ${ve(total)} veDOGI` : 'No votes yet';
  return {
    id: 'laika-' + r.proposalId, num: Number(r.proposalId), title: String(r.title || 'Untitled proposal').trim(),
    status, opened: r.startTime || null, endsAt: r.endTime || null,
    result: status === 'live' ? (total > 0n ? `${votes} so far` : votes) : votes + (status === 'passed' && r.canExecute ? ' · awaiting execution' : ''),
    proposer: String(r.proposer || '').toLowerCase(),
  };
}

let cache = null;
export const __clearDaoCache = () => { cache = null; }; // tests only
// -> { source: 'laika' | 'manual', proposals: [...] } newest first
export async function loadProposals() {
  const base = process.env.DAO_API_URL || LAIKA_PROPOSALS_URL;
  if (cache && Date.now() - cache.at < 60e3) return cache.data;
  let data = { source: 'manual', proposals: MANUAL };
  if (base) {
    try {
      const get = async (status) => {
        const r = await fetch(`${base}${base.includes('?') ? '&' : '?'}status=${status}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (DOGI community site)' }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(`laika ${status} -> ${r.status}`);
        const j = await r.json();
        return Array.isArray(j?.proposals) ? j.proposals : [];
      };
      const [active, past] = await Promise.all([get('active'), get('past')]);
      const byId = new Map();
      for (const r of [...past, ...active]) if (r && r.proposalId != null) byId.set(r.proposalId, r);
      const list = [...byId.values()].map(mapProposal)
        .filter((p) => OFFICIAL_PROPOSERS.includes(p.proposer))
        .sort((a, b) => b.num - a.num);
      data = { source: 'laika', proposals: list };
    } catch (e) { console.log('dao: laika unavailable, using manual list', String(e.message || e)); }
  }
  cache = { at: Date.now(), data };
  return data;
}

// ---- texts ----
const LABEL = { live: '🟢 Live', passed: '✅ Passed', executed: '✅ Executed', failed: '❌ Failed', canceled: '🚫 Canceled', ended: '⏹️ Ended' };
export const statusLabel = (s) => LABEL[s] || s;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const VOTE_BUTTONS = [
  [{ text: '🗳️ Vote on Laika', url: DAO_URL }],
  [{ text: '🏛️ DOGI DAO Watch', url: 'https://dogidrc20.org/dao.html' }],
];
const TESTNET = `🧪 ${NETWORK}: test tokens only, no real value.`;

// reply for the /dao command
export function daoSummary(proposals) {
  const live = proposals.filter((p) => p.status === 'live');
  const closed = proposals.filter((p) => p.status !== 'live').slice(0, 3);
  const line = (p) => `<b>#${p.num}</b> ${esc(p.title)}\n` + (p.status === 'live'
    ? [p.endsAt ? `⏳ Ends ${day(p.endsAt)}` : null, p.result ? `🗳️ ${esc(p.result)}` : null].filter(Boolean).join(' · ')
    : `${statusLabel(p.status)}${p.result ? ` · ${esc(p.result)}` : ''}`);
  const text = ['🏛️ <b>DOGI DAO Watch</b>', `<i>${NETWORK} · test tokens only, no real value</i>`, '',
    live.length ? `🟢 <b>Open for votes (${live.length})</b>` : 'No proposal is open for votes right now.',
    ...live.flatMap((p) => ['', line(p)]),
    ...(closed.length ? ['', '📜 <b>Recently closed</b>', ...closed.flatMap((p) => ['', line(p)])] : []),
  ].join('\n');
  return { text, buttons: VOTE_BUTTONS };
}

// posted once when a proposal opens for votes
export function newProposalAlert(p) {
  return {
    text: ['🗳️ <b>New DOGI DAO proposal</b>', '', `<b>#${p.num}</b> ${esc(p.title)}`, '',
      p.endsAt ? `⏳ Voting ends ${day(p.endsAt)}` : null, '🔒 Vote with veDOGI (lock your DOGI on Laika).', TESTNET].filter((l) => l !== null).join('\n'),
    buttons: VOTE_BUTTONS,
  };
}

// posted once when a proposal we announced closes
export function resultAlert(p) {
  return {
    text: ['🏁 <b>DOGI DAO vote closed</b>', '', `<b>#${p.num}</b> ${esc(p.title)}`, '',
      `${statusLabel(p.status)}${p.result ? ` · ${esc(p.result)}` : ''}`, TESTNET].join('\n'),
    buttons: [[{ text: '🏛️ DOGI DAO Watch', url: 'https://dogidrc20.org/dao.html' }]],
  };
}
