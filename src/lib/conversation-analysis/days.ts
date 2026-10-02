// Journées du rapport, dans le fuseau du pays (COUNTRY.timezone) : bornes UTC
// d'un jour local, liste des jours entre deux dates. Pur, testé.

/** Décalage (ms) du fuseau `tz` par rapport à UTC à l'instant `ms`. */
function offsetMs(ms: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  const asUtc = Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day), Number(o.hour) % 24, Number(o.minute), Number(o.second));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Instant UTC de minuit local du jour `dayKey` (AAAA-MM-JJ) dans `tz`. */
export function localMidnightUtc(dayKey: string, tz: string): Date {
  const naive = Date.parse(`${dayKey}T00:00:00Z`);
  // Deux passes : le décalage peut changer autour de minuit (heure d'été).
  let t = naive - offsetMs(naive, tz);
  t = naive - offsetMs(t, tz);
  return new Date(t);
}

/** Bornes [début, fin) du jour local `dayKey`, en ISO UTC. */
export function dayBounds(dayKey: string, tz: string): { start: string; end: string } {
  const next = new Date(`${dayKey}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: localMidnightUtc(dayKey, tz).toISOString(), end: localMidnightUtc(next.toISOString().slice(0, 10), tz).toISOString() };
}

/** Jours AAAA-MM-JJ de `from` à `to` inclus (max 400). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (const d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export const isDayKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
