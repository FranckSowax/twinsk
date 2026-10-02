import { describe, expect, it } from 'vitest';
import { dayBounds, daysBetween, isDayKey, localMidnightUtc } from './days';

describe('journées du rapport (fuseau du pays)', () => {
  it('Libreville (UTC+1) : le 2 octobre va de 1er oct. 23:00 UTC à 2 oct. 23:00 UTC', () => {
    expect(dayBounds('2026-10-02', 'Africa/Libreville')).toEqual({ start: '2026-10-01T23:00:00.000Z', end: '2026-10-02T23:00:00.000Z' });
  });
  it('Abidjan (UTC+0) : minuit = minuit UTC', () => {
    expect(dayBounds('2026-10-02', 'Africa/Abidjan')).toEqual({ start: '2026-10-02T00:00:00.000Z', end: '2026-10-03T00:00:00.000Z' });
  });
  it('fuseau avec heure d’été (Paris, passage du 25 oct. 2026) : jour de 25 h', () => {
    const b = dayBounds('2026-10-25', 'Europe/Paris');
    expect(b.start).toBe('2026-10-24T22:00:00.000Z');
    expect(b.end).toBe('2026-10-25T23:00:00.000Z');
    expect(localMidnightUtc('2026-07-01', 'Europe/Paris').toISOString()).toBe('2026-06-30T22:00:00.000Z');
  });
  it('liste des jours et validation', () => {
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(daysBetween('2026-10-03', '2026-10-02')).toEqual([]);
    expect(isDayKey('2026-10-02')).toBe(true);
    expect(isDayKey('2/10/2026')).toBe(false);
  });
});
