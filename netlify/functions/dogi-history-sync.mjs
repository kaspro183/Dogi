// Scheduled every 10 minutes: refreshes Doggy Market chart data, or (if refused) backfills the DOGI sales history
// (a few thousand sales per run until complete), then adds only the newest sales.
import { syncStep } from '../lib/history.mjs';

export default async () => {
  const status = await syncStep(22000);
  console.log('dogi-history sync', JSON.stringify(status));
  return new Response('ok');
};

export const config = { schedule: '*/10 * * * *' };
