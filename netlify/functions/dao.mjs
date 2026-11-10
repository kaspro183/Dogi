// GET /api/dao -> DOGI DAO proposals for dao.html (read from Laika, see netlify/lib/dao.mjs)
import { loadProposals, DAO_URL, NETWORK } from '../lib/dao.mjs';

export default async () => {
  const { source, proposals } = await loadProposals();
  return new Response(JSON.stringify({ network: NETWORK, voteUrl: DAO_URL, source, updated: new Date().toISOString(), proposals: proposals.map(({ proposer, ...p }) => p) }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'Netlify-CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
  });
};

export const config = { path: '/api/dao' };
