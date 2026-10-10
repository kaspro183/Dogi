// DOGI price history strip in the hero glow (home page).
// Data: /api/dogi-history = Doggy Market chart data, one median price per day, in DOGE.
// The block stays hidden if the data cannot be loaded.
(function () {
  const box = document.getElementById('hchart');
  if (!box) return;
  const plot = document.getElementById('hc-plot');
  const athEl = document.getElementById('hc-ath');
  const RANGES = { '7D': 7, '1M': 30, '1Y': 365, 'ALL': Infinity };
  let range = 'ALL', cur = 'D', DAYS = [], HAS_USD = false;

  // Drop isolated outlier days (e.g. one sale at a typo price): a day is removed when its
  // price is more than 4x above, or 4x below, the median of the 7 days on each side.
  function clean(days) {
    const med = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
    return days.filter((d, i) => {
      const around = days.slice(Math.max(0, i - 7), i).concat(days.slice(i + 1, i + 8)).map((x) => x[1]);
      if (around.length < 4) return true;
      const m = med(around);
      return d[1] <= m * 4 && d[1] >= m / 4;
    });
  }

  const fmtD = (x) => (x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3)) + ' Ð';
  const fmtU = (x) => '$' + (x >= 1 ? x.toFixed(2) : x >= 0.01 ? x.toFixed(3) : x.toFixed(4));
  const fmt = (x) => (cur === '$' ? fmtU(x) : fmtD(x));
  const val = (d) => (cur === '$' ? (d[4] ? d[1] * d[4] : null) : d[1]);
  const dlong = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  function draw() {
    const src = DAYS.filter((d) => val(d) != null).map((d) => [d[0], val(d), d[2], d[3], d]);
    const n0 = RANGES[range], pts = n0 === Infinity ? src : src.slice(-n0);
    if (pts.length < 2) { plot.innerHTML = ''; return; }
    const W = Math.max(280, plot.clientWidth || 1080), H = W < 600 ? 130 : 150, pr = 46, pt = 10, pb = 20, n = pts.length - 1;
    const vals = pts.map((d) => d[1]);
    const hi = Math.max(...vals), lo = Math.min(...vals);
    const min = range === 'ALL' ? 0 : lo * 0.9, max = hi * 1.08;
    const X = (i) => (i / n) * (W - pr), Y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
    let d = '';
    pts.forEach((p, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[1]).toFixed(1); });
    const ai = vals.indexOf(hi);
    let g = '';
    [0, 0.5, 1].forEach((f) => {
      const v = min + (max - min) * f, y = Y(v);
      g += `<line x1="0" x2="${W - pr}" y1="${y}" y2="${y}" stroke="rgba(245,196,0,.12)" stroke-dasharray="3 5"/><text class="hc-ax" x="${W - pr + 8}" y="${y + 4}">${cur === '$' ? (v >= 0.01 ? v.toFixed(2) : v.toFixed(3)) : v >= 1 ? v.toFixed(1) : v.toFixed(2)}</text>`;
    });
    // x labels: years for ALL, months for 1Y, dates otherwise
    const labs = [];
    if (range === 'ALL' || range === '1Y') {
      for (let i = 1; i <= n; i++) {
        const a = pts[i][0], b = pts[i - 1][0];
        if (range === 'ALL' ? a.slice(0, 4) !== b.slice(0, 4) : a.slice(0, 7) !== b.slice(0, 7))
          labs.push([i, range === 'ALL' ? a.slice(0, 4) : new Date(a + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })]);
      }
    } else {
      for (let j = 0; j < 4; j++) { const i = Math.round((j * n) / 3); labs.push([i, new Date(pts[i][0] + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })]); }
    }
    labs.forEach(([i, t]) => { g += `<text class="hc-ax" x="${Math.max(16, Math.min(X(i), W - pr - 24))}" y="${H - 3}" text-anchor="middle">${t}</text>`; });
    plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="DOGI price history in DOGE">
<defs><linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdb4d" stop-opacity=".45"/><stop offset="1" stop-color="#f5c400" stop-opacity="0"/></linearGradient><filter id="hcf"><feGaussianBlur stdDeviation="3"/></filter></defs>${g}
<path d="${d}L${X(n)} ${H - pb}L0 ${H - pb}Z" fill="url(#hcg)"/>
<path d="${d}" fill="none" stroke="#ffdb4d" stroke-width="4" opacity=".4" filter="url(#hcf)"/>
<path d="${d}" fill="none" stroke="#ffe680" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
<circle cx="${X(ai)}" cy="${Y(hi)}" r="4" fill="#0d0b08" stroke="#f5c400" stroke-width="2"/>
<circle cx="${X(n)}" cy="${Y(vals[n])}" r="9" fill="#f5c400" opacity=".3"/><circle cx="${X(n)}" cy="${Y(vals[n])}" r="4.5" fill="#f5c400"/>
<line class="hc-hl" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="#f5c400" stroke-opacity=".55" stroke-dasharray="2 4" vector-effect="non-scaling-stroke" style="display:none"/>
</svg><div class="hc-dot"></div><div class="hc-tip"></div>`;
    athEl.textContent = fmt(Math.max(...src.map((x) => x[1])));

    const svg = plot.querySelector('svg'), tip = plot.querySelector('.hc-tip'), dot = plot.querySelector('.hc-dot'), hl = svg.querySelector('.hc-hl');
    const move = (e) => {
      const b = svg.getBoundingClientRect(), cx = (e.touches ? e.touches[0].clientX : e.clientX) - b.left;
      const i = Math.max(0, Math.min(n, Math.round(((cx / b.width) * W / (W - pr)) * n)));
      const x = X(i), y = Y(pts[i][1]), px = (x / W) * b.width, py = (y / H) * b.height;
      hl.setAttribute('x1', x); hl.setAttribute('x2', x); hl.style.display = '';
      dot.style.cssText = `display:block;left:${px}px;top:${py}px`;
      const raw = pts[i][4], other = cur === '$' ? fmtD(raw[1]) : (raw[4] ? '≈ ' + fmtU(raw[1] * raw[4]) : '');
      tip.innerHTML = `<span>${dlong(pts[i][0])}</span><b>${fmt(pts[i][1])}</b><span>${other}${other ? ' · ' : ''}${pts[i][3]} trade${pts[i][3] > 1 ? 's' : ''}</span>`;
      tip.style.display = 'block';
      tip.style.left = Math.min(px + 14, b.width - tip.offsetWidth - 2) + 'px';
      tip.style.top = Math.max(-8, py - tip.offsetHeight - 10) + 'px';
    };
    const leave = () => { tip.style.display = 'none'; dot.style.display = 'none'; hl.style.display = 'none'; };
    svg.addEventListener('mousemove', move);
    svg.addEventListener('touchmove', move, { passive: true });
    svg.addEventListener('touchstart', move, { passive: true });
    svg.addEventListener('mouseleave', leave);
    svg.addEventListener('touchend', () => setTimeout(leave, 1500));
  }

  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => DAYS.length && draw(), 150); });

  box.querySelectorAll('.hc-seg[data-k="range"] b').forEach((b) => b.addEventListener('click', () => {
    box.querySelectorAll('.hc-seg[data-k="range"] b').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); range = b.textContent.trim(); draw();
  }));
  box.querySelectorAll('.hc-seg[data-k="cur"] b').forEach((b) => b.addEventListener('click', () => {
    box.querySelectorAll('.hc-seg[data-k="cur"] b').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); cur = b.dataset.cur; draw();
  }));

  fetch('/api/dogi-history').then((r) => r.ok ? r.json() : null).then((j) => {
    if (!j || !j.complete || !Array.isArray(j.days) || j.days.length < 10) return; // stay hidden
    DAYS = clean(j.days);
    HAS_USD = DAYS.filter((d) => d[4]).length > DAYS.length * 0.9;
    if (HAS_USD) box.querySelector('.hc-seg[data-k="cur"]').hidden = false;
    box.hidden = false;
    document.body.classList.add('has-hchart');
    draw();
  }).catch(() => {});
})();
