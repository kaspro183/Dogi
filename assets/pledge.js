// Liquidity pledges page: reads pledges.json + live prices from /api/dogi
(function(){
  const $=id=>document.getElementById(id);
  if(!$('pl-rows')) return;
  const SHIBE=1e8;
  const nf=(n,d=0)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:d});
  const usd=n=>'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const FALLBACK={dogiDoge:0.84,dogeUsd:0.0957,label:'last known prices (Oct 2026)'};
  async function prices(){
    try{
      const r=await fetch('/api/dogi',{cache:'no-store'}); if(!r.ok) throw 0;
      const d=await r.json(); const p=d?.token?.lastPrice; const du=d?.dogeUsd;
      if(!p||!du) throw 0;
      return {dogiDoge:p/SHIBE,dogeUsd:du,label:'live prices'};
    }catch(e){ return FALLBACK; }
  }
  async function data(){
    const r=await fetch('/api/pledges',{cache:'no-store'}); if(!r.ok) throw new Error('pledges');
    return r.json();
  }
  let P=null, D=null;
  async function load(){ const [d,p]=await Promise.all([data(), P?Promise.resolve(P):prices()]); P=p; D=d; render(d,p); }
  function render(d,p){
    const list=(d.pledges||[]).slice();
    const val=x=>(Number(x.doge||0)+Number(x.dogi||0)*p.dogiDoge)*p.dogeUsd;
    list.sort((a,b)=>val(b)-val(a));
    let tD=0,tG=0,tU=0;
    $('pl-rows').innerHTML=list.map((x,i)=>{
      const v=val(x); tD+=Number(x.doge||0); tG+=Number(x.dogi||0); tU+=v;
      return '<div class="pl-row"><span>'+(i+1)+'</span><span class="pl-n">'+esc(x.name)+'</span><span data-l="DOGE">'+nf(x.doge)+'</span><span data-l="DOGI">'+nf(x.dogi)+'</span><span data-l="≈ USD" class="pl-u">'+usd(v)+'</span><span data-l="Date" class="pl-d">'+esc(x.date||'')+'</span></div>';
    }).join('');
    $('pl-empty').style.display=list.length?'none':'block';
    const goal=Number(d.goalUsd||100000), pct=Math.min(100,tU/goal*100);
    $('pl-total').textContent=usd(tU); $('pl-goal').textContent=usd(goal);
    $('pl-fill').style.width=pct.toFixed(1)+'%'; $('pl-pct').textContent=(pct<1&&pct>0?pct.toFixed(1):Math.round(pct))+'%';
    $('pl-count').textContent=list.length+(list.length===1?' pledge':' pledges'); $('pl-doge').textContent=nf(tD); $('pl-dogi').textContent=nf(tG);
    $('pl-upd').textContent=d.updated||'–';
    $('pl-rate').textContent='USD values use '+p.label+': 1 DOGI ≈ '+p.dogiDoge.toFixed(3)+' DOGE, 1 DOGE ≈ $'+p.dogeUsd.toFixed(4)+'. Values move with the market.';
  }
  load().catch(()=>{ $('pl-empty').textContent='Could not load pledges right now. Try again later.'; });

  const f=$('pl-form'), msg=$('pl-msg');
  if(f) f.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=new FormData(f), clean=v=>String(v||'').replace(/[\s,_']/g,'');
    const body={name:String(fd.get('name')||'').trim(), doge:clean(fd.get('doge')), dogi:clean(fd.get('dogi')), website:fd.get('website')};
    msg.className='pl-msg';
    if(!/^@?[A-Za-z0-9_]{4,32}$/.test(body.name)){ msg.className='pl-msg err'; msg.textContent='Enter your Telegram @username.'; return; }
    if(!(Number(body.doge)>0) && !(Number(body.dogi)>0)){ msg.className='pl-msg err'; msg.textContent='Enter a DOGE and/or DOGI amount.'; return; }
    const btn=f.querySelector('button'); btn.disabled=true; msg.textContent='Sending…';
    try{
      const r=await fetch('/api/pledge-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.error) throw new Error(d.error||'Something went wrong. Try again.');
      msg.className='pl-msg ok';
      msg.textContent='✅ Pledge '+(d.updated?'updated':'recorded')+' for '+d.name+': '+nf(d.doge)+' DOGE + '+nf(d.dogi)+' DOGI. It shows in the table within a minute.';
      f.reset();
      if(D&&P){ const list=(D.pledges||[]).filter(x=>String(x.name).toLowerCase()!==d.name.toLowerCase());
        list.push({name:d.name,doge:d.doge,dogi:d.dogi,date:new Date().toISOString().slice(0,10)}); D={...D,pledges:list}; render(D,P); }
    }catch(err){ msg.className='pl-msg err'; msg.textContent=err.message; }
    finally{ btn.disabled=false; }
  });
})();
