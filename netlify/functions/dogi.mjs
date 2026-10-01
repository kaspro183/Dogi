// Netlify Function: fetches DOGI stats from Doggy Market (server-side, no CORS issue)
// and the DOGE/USD rate, then returns one JSON payload. Cached 60s at the edge.
export default async () => {
  const headers = { 'User-Agent': 'Mozilla/5.0 (DOGI site)', 'Accept': 'application/json' };
  try {
    const [tokRes, dogeRes] = await Promise.allSettled([
      fetch('https://api.doggy.market/token/dogi', { headers }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd', { headers }),
    ]);
    if (tokRes.status !== 'fulfilled' || !tokRes.value.ok) throw new Error('doggy.market unavailable');
    const token = await tokRes.value.json();
    let dogeUsd = null;
    if (dogeRes.status === 'fulfilled' && dogeRes.value.ok) {
      const d = await dogeRes.value.json();
      dogeUsd = d?.dogecoin?.usd ?? null;
    }
    return new Response(JSON.stringify({ token, dogeUsd, fetchedAt: new Date().toISOString() }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const config = { path: '/api/dogi' };
