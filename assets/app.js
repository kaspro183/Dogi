(function(){
  const fmtUsd = (n, d) => {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(d);
  };
  const setChg = (el, v) => {
    if (v == null || isNaN(v)) { el.textContent = ''; return; }
    el.textContent = (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(2) + '%';
    el.className = 'chg ' + (v >= 0 ? 'up' : 'down');
  };
  const $ = id => document.getElementById(id);

  // Doggy Market returns prices in shibes (1 DOGE = 100,000,000 shibes)
  const SHIBE = 1e8;
  const fmtDoge = (n) => {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e6) return (n/1e6).toFixed(2) + 'M Ð';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'K Ð';
    return n.toLocaleString('en-US', {maximumFractionDigits: n < 10 ? 4 : 2}) + ' Ð';
  };
  let dogeUsd = null;

  const usd = (doge, d) => (dogeUsd && doge != null) ? '≈ ' + fmtUsd(doge * dogeUsd, d) : '';

  // Last known values (Doggy Market, Oct 1 2026) shown if live data can't be reached
  const SNAPSHOT = { token: { lastPrice: 89400000, floorPrice: 88000000, marketcap: 1877400000000000,
    holders: 11078, listings: 1496, change7d: -0.0678 }, dogeUsd: 0.0957, date: 'Oct 1, 2026' };

  async function getJson(url){
    const r = await fetch(url, {cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    return r.json();
  }

  async function fetchLive(){
    // 1) own Netlify function (no CORS issue)  2) Doggy Market directly
    try{
      const d = await getJson('/api/dogi');
      if(d && d.token) return d;
    }catch(e){}
    const token = await getJson('https://api.doggy.market/token/dogi');
    let du = null;
    try{ const g = await getJson('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd'); du = g.dogecoin && g.dogecoin.usd; }catch(e){}
    return { token, dogeUsd: du };
  }

  function render(t){
    const last = t.lastPrice / SHIBE, floor = t.floorPrice / SHIBE, mcap = t.marketcap / SHIBE;
    $('s-price').textContent = fmtDoge(last);
    setChg($('s-chg'), t.change7d != null ? t.change7d * 100 : null);
    if (t.change7d != null) $('s-chg').textContent += ' 7d';
    $('s-price-usd').textContent = usd(last, 4);
    $('s-floor').textContent = fmtDoge(floor);
    $('s-floor-usd').textContent = usd(floor, 4);
    $('s-mcap').textContent = fmtDoge(mcap);
    $('s-mcap-usd').textContent = usd(mcap, 0);
    $('s-holders').textContent = Number(t.holders).toLocaleString('en-US');
    $('s-list').textContent = t.listings != null ? Number(t.listings).toLocaleString('en-US') + ' listings' : '';
  }

  let hasLive = false;
  async function load(){
    try{
      const d = await fetchLive();
      if(d.dogeUsd) dogeUsd = d.dogeUsd;
      render(d.token);
      hasLive = true;
      $('s-dot').classList.remove('off');
      $('s-status').textContent = 'Live · updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    }catch(e){
      if(hasLive) return; // keep the last live values on a temporary failure
      dogeUsd = SNAPSHOT.dogeUsd;
      render(SNAPSHOT.token);
      $('s-dot').classList.add('off');
      $('s-status').innerHTML = 'Last known values (' + SNAPSHOT.date + '). <a href="https://doggy.market/dogi" target="_blank" rel="noopener" style="color:var(--gold)">Live price on Doggy Market →</a>';
    }
  }
  if ($('stats')) { load(); setInterval(load, 60000); }
  const bg = document.querySelector('.burger');
  if (bg) bg.addEventListener('click', () => { const l = document.querySelector('.links'); const o = l.classList.toggle('open'); bg.setAttribute('aria-expanded', o); });

  const io = new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
  }), {threshold:.12});
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  if ($('yr')) $('yr').textContent = new Date().getFullYear();
})();

// Hero mascot: twinkling stars + shooting stars on a canvas
(function(){
  const c = document.querySelector('.mascot .stars');
  if (!c) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = c.getContext('2d');
  let w, h, dpr, stars = [], shots = [], last = 0;
  function size(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({length: Math.round(w * h / 2600)}, () => ({
      x: Math.random() * w, y: Math.random() * h * 0.75,
      r: Math.random() * 1.3 + 0.3, p: Math.random() * Math.PI * 2,
      s: 0.6 + Math.random() * 1.6, gold: Math.random() < 0.3
    }));
  }
  function shoot(){
    shots.push({x: w * (0.3 + Math.random() * 0.7), y: -10, vx: -(2.2 + Math.random()), vy: 1.6 + Math.random(), life: 1});
  }
  function frame(t){
    const dt = Math.min((t - last) / 16.7, 3); last = t;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars){
      const a = reduce ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.s + s.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.gold ? '#ffdb4d' : '#fff6dc';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    if (!reduce){
      if (Math.random() < 0.004 * dt) shoot();
      for (const s of shots){
        s.x += s.vx * dt * 2; s.y += s.vy * dt * 2; s.life -= 0.012 * dt;
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 22, s.y - s.vy * 22);
        g.addColorStop(0, 'rgba(255,230,140,' + Math.max(s.life, 0) + ')');
        g.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 22, s.y - s.vy * 22); ctx.stroke();
      }
      shots = shots.filter(s => s.life > 0 && s.y < h + 20);
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }
  size();
  window.addEventListener('resize', size);
  if (reduce) frame(0); else { setTimeout(shoot, 900); requestAnimationFrame(frame); }
})();
