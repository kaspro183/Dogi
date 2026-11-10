// DOGI DAO Watch: renders the official proposals from /api/dao
(function () {
  const live = document.getElementById('dao-live');
  if (!live) return;
  const closedWrap = document.getElementById('dao-closed-wrap');
  const closed = document.getElementById('dao-closed');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const LABEL = { live: 'Live', passed: 'Passed', executed: 'Executed', failed: 'Failed', canceled: 'Canceled', ended: 'Ended' };

  function left(iso) {
    const ms = Date.parse(iso) - Date.now();
    if (!(ms > 0)) return 'Voting closed';
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5);
    return d ? `${d}d ${h}h left` : `${h}h left`;
  }

  function card(p, voteUrl) {
    const isLive = p.status === 'live';
    const meta = [
      p.opened ? `Opened ${day(p.opened)}` : null,
      isLive ? (p.endsAt ? `⏳ ${left(p.endsAt)} · ends ${day(p.endsAt)}` : 'Time left: see Laika') : (p.endsAt ? `Ended ${day(p.endsAt)}` : null),
      p.result ? `<b>${esc(p.result)}</b>` : null,
    ].filter(Boolean).join(' · ');
    return `<article class="prop${isLive ? ' live' : ''}">
      <div class="prop-top"><span class="prop-n mono">PROPOSAL #${esc(p.num)}</span><span class="pill ${esc(p.status)}">${isLive ? '<i class="pulse"></i>' : ''}${LABEL[p.status] || esc(p.status)}</span></div>
      <h3>${esc(p.title)}</h3>
      <div class="prop-foot"><span class="prop-meta">${meta}</span>${isLive ? `<a class="btn btn-gold" href="${esc(voteUrl)}" target="_blank" rel="noopener">Vote ↗</a>` : ''}</div>
    </article>`;
  }

  fetch('/api/dao').then((r) => r.json()).then((d) => {
    const ps = Array.isArray(d.proposals) ? d.proposals : [];
    const open = ps.filter((p) => p.status === 'live'), done = ps.filter((p) => p.status !== 'live');
    live.innerHTML = open.length ? open.map((p) => card(p, d.voteUrl)).join('') : '<p class="dao-empty">No proposal is open for votes right now. New ones are announced in the Telegram group.</p>';
    if (done.length) { closed.innerHTML = done.map((p) => card(p, d.voteUrl)).join(''); closedWrap.hidden = false; }
  }).catch(() => {
    live.innerHTML = '<p class="dao-empty">Proposals could not be loaded. You can still see them directly on <a href="https://testnet.laika.market/tokens?address=0xF88599E8881e3133176D4F7937204c7A8bDB5776&amp;view=dao" target="_blank" rel="noopener">Laika ↗</a>.</p>';
  });
})();
