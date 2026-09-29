import { describe, expect, it } from 'vitest';
import { bucketKey, bucketKeys, conversationOrigin, funnel, heatmap, listingIdIn, median, parsePeriod, periodStart, responderLabel, responsesByPerson, responseSamples, summarizeResponses, type ActivityMessage } from './admin-activity';

const msg = (conv: string, from_me: boolean, at: string, sent_by: string | null = null, sender_name: string | null = null): ActivityMessage => ({ conversation_id: conv, from_me, sent_at: at, sent_by, sender_name });

describe('période', () => {
  it('7 / 30 / 90 / tout, 30 par défaut', () => {
    expect(parsePeriod('7')).toBe('7');
    expect(parsePeriod('x')).toBe('30');
    expect(periodStart('all')).toBeNull();
    expect(periodStart('7', new Date('2026-09-29T00:00:00Z'))).toBe('2026-09-22T00:00:00.000Z');
  });
  it('jours et semaines dans le fuseau du pays (lundi)', () => {
    // 29 sept. 2026 = mardi ; 23 h 30 UTC = 00 h 30 le 30 à Libreville (UTC+1).
    expect(bucketKey('2026-09-29T23:30:00Z', 'day', 'Africa/Libreville')).toBe('2026-09-30');
    expect(bucketKey('2026-09-29T10:00:00Z', 'week', 'Africa/Libreville')).toBe('2026-09-28');
    expect(bucketKeys('2026-09-27T10:00:00Z', '2026-09-29T10:00:00Z', 'day', 'UTC')).toEqual(['2026-09-27', '2026-09-28', '2026-09-29']);
  });
});

describe('temps de première réponse — 24 h/24', () => {
  const messages = [
    msg('c1', false, '2026-09-29T08:00:00Z'),
    msg('c1', false, '2026-09-29T08:05:00Z'), // même rafale : compte depuis 08:00
    msg('c1', true, '2026-09-29T08:30:00Z', 'admin'),
    msg('c1', false, '2026-09-29T20:00:00Z'), // nouvelle demande
    msg('c1', true, '2026-09-29T20:10:00Z', 'u1', 'Awa'),
    msg('c2', false, '2026-09-29T09:00:00Z'), // jamais répondue
    msg('c3', false, '2026-09-29T10:00:00Z'),
    msg('c3', true, '2026-09-29T12:00:00Z'), // depuis le téléphone
  ];
  const samples = responseSamples(messages);
  it('une demande par rafale, réponse = notre premier message suivant', () => {
    expect(samples.map((s) => [s.conversation_id, s.minutes, s.responder]).sort()).toEqual([
      ['c1', 10, 'Awa'],
      ['c1', 30, 'Admin'],
      ['c2', null, null],
      ['c3', 120, 'Téléphone'],
    ]);
  });
  it('médiane, moyenne, part en moins de 15 min / 1 h, sans réponse', () => {
    expect(summarizeResponses(samples)).toEqual({ requests: 4, answered: 3, unanswered: 1, medianMinutes: 30, meanMinutes: 160 / 3, within15: 1 / 3, within60: 2 / 3 });
    expect(median([])).toBeNull();
  });
  it('par personne', () => {
    expect(responsesByPerson(samples).map((p) => p.name).sort()).toEqual(['Admin', 'Awa', 'Téléphone']);
    expect(responderLabel({ sent_by: 'x', sender_name: null })).toBe('Équipe');
  });
});

describe('heures de pointe, origine, entonnoir', () => {
  it('carte jour × heure (lundi = 0)', () => {
    const g = heatmap(['2026-09-28T09:15:00Z', '2026-09-28T09:40:00Z'], 'UTC'); // lundi 9 h
    expect(g[0][9]).toBe(2);
    expect(g.flat().reduce((a, b) => a + b, 0)).toBe(2);
  });
  it('listing : lien dans la pub, sinon premier lien échangé, sinon titre de la pub', () => {
    const id = 'e577dc5c-433c-4f77-a83f-66b3b97db7ae';
    expect(listingIdIn(`Catalogue : https://x.app/offer/${id}?utm=1`)).toBe(id);
    expect(conversationOrigin({ adBodies: [`… https://x.app/offer/${id}`], adTitle: 'Canapés', fromAd: true, linkTexts: [] })).toEqual({ listingId: id, adTitle: 'Canapés', fromAd: true });
    expect(conversationOrigin({ adBodies: ['sans lien'], adTitle: 'Pizzeria', fromAd: true, linkTexts: [] }).listingId).toBeNull();
    expect(conversationOrigin({ adBodies: [], adTitle: null, fromAd: false, linkTexts: [`/offer/${id}`] }).listingId).toBe(id);
  });
  it('entonnoir : conversations → paniers → transport → paiement engagé → payés', () => {
    const f = funnel(10, [
      { transport_mode: 'air', payment_status: 'paid' },
      { transport_mode: 'sea', payment_status: 'submitted' },
      { transport_mode: null, payment_status: 'pending' },
    ]);
    expect(f.map((x) => x.value)).toEqual([10, 3, 2, 2, 1]);
  });
});
