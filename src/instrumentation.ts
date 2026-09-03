// Planificateur interne du goutte-à-goutte : le conteneur de l'app tourne en
// continu sur Railway, il déclenche lui-même la publication à chaque heure pile
// (+ 30 s). Le verrou « une publication par heure locale » de runDrip rend les
// doublons impossibles, même si le service cron externe appelle aussi la route.
//
// Actif uniquement en production, côté Node (pas Edge), et désactivable avec
// DRIP_INTERNAL_SCHEDULER=off.

import { PUBLIC_ORIGIN_FALLBACK } from '@/lib/public-origin';

const OFFSET_MS = 30_000;

function msUntilNextHour(): number {
  const now = Date.now();
  const next = Math.ceil((now - OFFSET_MS) / 3_600_000) * 3_600_000 + OFFSET_MS;
  return Math.max(1_000, next - now);
}

async function tick(): Promise<void> {
  try {
    const { runDrip } = await import('@/lib/wa-drip-run');
    const result = await runDrip({ origin: PUBLIC_ORIGIN_FALLBACK, actor: 'scheduler' });
    const label = 'skipped' in result ? `ignoré (${result.skipped})` : 'error' in result ? `erreur : ${result.error}` : 'summary' in result ? result.summary : 'ok';
    console.log(`[drip-scheduler] ${new Date().toISOString()} ${label}`);
  } catch (err) {
    console.error('[drip-scheduler] échec', err);
  }
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.DRIP_INTERNAL_SCHEDULER === 'off') return;

  const schedule = () => {
    const wait = msUntilNextHour();
    console.log(`[drip-scheduler] prochain tir dans ${Math.round(wait / 1000)} s`);
    setTimeout(async () => {
      await tick();
      schedule();
    }, wait).unref();
  };
  schedule();
}
