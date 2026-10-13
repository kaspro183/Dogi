// DOGI balance checker (balance.html). Read-only: sends a public address to /api/balance. Nothing is stored.
(function () {
  const form = document.getElementById('bc-form');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const ADDR = /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/;
  const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const date = (t) => new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let cur = '', next = null, rows = 0, market = null, floorDoge = null, total = 0;
  const short = (a) => !a ? '—' : a === cur ? 'this address' : a.slice(0, 5) + '…' + a.slice(-5);

  // DOGE/USD (and DOGI floor as a fallback), same source as the home page
  const marketReady = fetch('/api/dogi').then((r) => r.ok ? r.json() : null).then((j) => { if (j && j.token) market = j; }).catch(() => {});
  const msg = (t, err) => { const m = $('bc-msg'); m.textContent = t || ''; m.classList.toggle('err', !!err); };

  async function load(address, offset) {
    const r = await fetch('/api/balance?address=' + encodeURIComponent(address) + '&offset=' + offset);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || r.status);
    return j;
  }

  async function check(address) {
    cur = address; next = null; rows = 0;
    $('bc-res').hidden = true; $('bc-hist').hidden = true; $('bc-rows').innerHTML = '';
    if (!ADDR.test(address)) { msg('This does not look like a Dogecoin address (it should start with D, A or 9).', true); return; }
    msg('Checking…');
    history.replaceState(null, '', '?address=' + address);
    try {
      const j = await load(address, 0);
      await marketReady;
      renderBalance(j);
      renderHistory(j);
      msg('');
    } catch (e) {
      msg('Could not reach Doggy Market right now. Please try again in a minute.', true);
    }
  }

  function value() {
    const floor = floorDoge || (market ? market.token.floorPrice / 1e8 : null);
    if (!total || !floor) return total ? '' : 'No DOGI on this address';
    const doge = total * floor;
    return '≈ ' + Math.round(doge).toLocaleString('en-US') + ' Ð' + (market && market.dogeUsd ? ' · ≈ $' + Math.round(doge * market.dogeUsd).toLocaleString('en-US') : '') + ' at floor';
  }

  function renderBalance(j) {
    const b = j.balance || { total: 0, available: 0, inscribed: 0 };
    total = b.total; floorDoge = j.floorDoge;
    $('bc-addr-out').textContent = j.address;
    $('bc-dm').href = 'https://doggy.market/wallet/' + j.address;
    $('bc-total').textContent = fmt(b.total);
    $('bc-avail').textContent = fmt(b.available);
    $('bc-insc').textContent = fmt(b.inscribed);
    $('bc-val').textContent = value();
    $('bc-res').hidden = false;
  }

  function renderHistory(j) {
    const html = (j.history || []).map((h) => {
      let act, cls, sign;
      if (h.type === 'transfer') {
        const inbound = h.to === j.address;
        act = inbound ? 'Receive' : 'Send'; cls = inbound ? 'in' : 'out'; sign = inbound ? '+' : '−';
      } else if (h.type === 'inscribe-transfer') { act = 'Inscribe'; cls = 'ins'; sign = ''; }
      else if (h.type === 'mint') { act = 'Mint'; cls = 'in'; sign = '+'; }
      else { act = h.type || '—'; cls = ''; sign = ''; }
      const route = h.type === 'transfer' ? `${esc(short(h.from))} → ${esc(short(h.to))}` : '';
      return `<div class="bc-row" role="row"><span class="act ${cls}">${esc(act)}</span><span class="mono">${sign}${fmt(h.amount)}</span><span class="mono">${route}</span><span class="mono">${esc(date(h.time))}</span></div>`;
    }).join('');
    $('bc-rows').insertAdjacentHTML('beforeend', html);
    rows += (j.history || []).length;
    next = j.next;
    $('bc-more').hidden = next == null;
    $('bc-empty').hidden = rows > 0 || next != null;
    $('bc-hist').hidden = false;
  }

  $('bc-more').addEventListener('click', async () => {
    if (next == null) return;
    const btn = $('bc-more'); btn.disabled = true; btn.textContent = 'Loading…';
    try { renderHistory(await load(cur, next)); } catch (e) { msg('Could not load more activity right now.', true); }
    btn.disabled = false; btn.textContent = 'Load older activity';
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); check($('bc-addr').value.trim()); });
  const q = new URLSearchParams(location.search).get('address');
  if (q) { $('bc-addr').value = q; check(q.trim()); }
})();
