import { describe, expect, it } from 'vitest';
import { buildComparison, shortLabel, variantChoices } from './compare-view';
import type { PublicOffer, PublicOfferItem } from './public';

const item = (x: Partial<PublicOfferItem> & { id: string; label: string; line_id: string | null; price: number | null }): PublicOfferItem => ({ kind: 'base', variant: {}, unit: 'm²', per: 'unit', qty: null, tiers: [], total: null, below_min: false, ...x });
const offer = (x: Partial<PublicOffer> & { id: string; lot: string; alias: string; items: PublicOfferItem[] }): PublicOffer => ({ supplier_status: 'shortlisted', score: null, title: '', incoterm: 'FOB', valid_until: null, lead_time: null, moq: null, interested: false, updated_at: '', ...x });
const lines = [
  { id: 'g', lot: 'Gazon', label: 'Gazon synthétique non-infill 30 mm (backing PU, UV 5 000 h)', unit: 'm²', effective_quantity: 5800 },
  { id: 's', lot: 'Gazon', label: 'Sous-couche amortissante shockpad 10 mm', unit: 'm²', effective_quantity: 4800 },
  { id: 'p', lot: 'Padel', label: 'Kit padel panoramique 20×10 m — verre 12 mm', unit: 'kit', effective_quantity: 8 },
];

describe('comparaison client : cartes par lot', () => {
  it('libellé court : coupé avant la parenthèse ou le tiret, limité en longueur', () => {
    expect(shortLabel('Gazon synthétique non-infill 30 mm (backing PU, UV 5 000 h)')).toBe('Gazon synthétique non-infill 30 mm');
    expect(shortLabel('Kit padel panoramique 20×10 m — verre 12 mm')).toBe('Kit padel panoramique 20×10 m');
    expect(shortLabel('x'.repeat(80), 20)).toBe(`${'x'.repeat(19)}…`);
  });
  it('variantes : un choix seulement si plusieurs valeurs sur une même ligne (deux produits différents ne sont pas une variante)', () => {
    const set = [item({ id: 'a', label: 'Padel', line_id: 'p', price: 11125, variant: { Dimensions: '20×10 m' } }), item({ id: 'b', label: 'Cage', line_id: 'c', price: 12500, variant: { Dimensions: '30×20 m' } })];
    expect(variantChoices([set])).toEqual({});
    const two = [[item({ id: 'a', label: 'Gazon 30', line_id: 'g', price: 6.13, variant: { Hauteur: '30 mm' } })], [item({ id: 'b', label: 'Gazon 40', line_id: 'g', price: 6.75, variant: { Hauteur: '40 mm' } })]];
    expect(variantChoices(two)).toEqual({ Hauteur: ['30 mm', '40 mm'] });
  });
  it('offre set complet comparée dans chaque lot où elle chiffre une ligne, puis dans sa section ; meilleur prix et écart', () => {
    const ldk = offer({ id: 'o1', lot: 'Set complet', alias: 'Fournisseur A', score: 22, items: [
      item({ id: 'g1', label: 'Gazon 50 mm', line_id: 'g', price: 13.38, qty: 5800, total: 77604, variant: { Hauteur: '50 mm' } }),
      item({ id: 's1', label: 'Shock pad', line_id: 's', price: 6.13, qty: 4800, total: 29424 }),
      item({ id: 'p1', label: 'Padel', line_id: 'p', price: 11125, qty: 8, total: 89000, unit: 'set' }),
      item({ id: 'd1', kind: 'option', label: 'Porte', line_id: 'p', price: 368.75, qty: 8, total: 2950, unit: 'set' }),
    ] });
    const taishan = offer({ id: 'o2', lot: 'Gazon', alias: 'Fournisseur B', items: [
      item({ id: 't1', label: 'TS PIKE', line_id: 'g', price: 6.13, qty: 5800, total: 35554, variant: { Hauteur: '30 mm' } }),
      item({ id: 't2', label: 'TS PIKE 40', line_id: 'g', price: 6.75, qty: 5800, total: 39150, variant: { Hauteur: '40 mm' } }),
      item({ id: 't3', label: 'Shockpad', line_id: 's', price: 3.25, qty: 4800, total: 15600 }),
      item({ id: 'f', kind: 'fee', label: 'Échantillons', line_id: null, price: 100, total: 100, per: 'order' }),
    ] });
    const { lots, overview } = buildComparison({ offers: [ldk, taishan], quote: { lines } });
    expect(lots.map((l) => [l.lot, l.isSet, l.offers.length])).toEqual([['Gazon', false, 2], ['Padel', false, 1], ['Set complet', true, 1]]);
    const gazon = lots[0];
    expect(gazon.offers[0]).toMatchObject({ alias: 'Fournisseur B', total: 51254, best: true, deltaPct: null, crossLot: false });
    expect(gazon.offers[0].lines.map((l) => [l.short, l.price, l.alternatives])).toEqual([['Gazon synthétique non-infill 30 mm', 6.13, 1], ['Sous-couche amortissante shockpad 10 mm', 3.25, 0]]);
    expect(gazon.offers[0].fees).toHaveLength(1);
    expect(gazon.offers[1]).toMatchObject({ alias: 'Fournisseur A', total: 107028, best: false, deltaPct: 108.82, crossLot: true });
    expect(gazon.offers[1].options).toEqual([]);
    expect(gazon.variantChoices).toEqual({ Hauteur: ['50 mm', '30 mm', '40 mm'] });
    // Filtre de variante : 40 mm retenu pour Fournisseur B.
    const filtered = buildComparison({ offers: [ldk, taishan], quote: { lines } }, { Gazon: { Hauteur: '40 mm' } }).lots[0];
    expect(filtered.offers.find((o) => o.alias === 'Fournisseur B')!.total).toBe(54850);
    expect(lots[1].offers[0]).toMatchObject({ total: 89000, best: false, crossLot: true });
    expect(lots[1].offers[0].options.map((o) => o.label)).toEqual(['Porte']);
    expect(lots[2].offers[0]).toMatchObject({ total: 196028, crossLot: false, lines: expect.arrayContaining([expect.objectContaining({ lot: 'Padel' })]) });
    expect(overview).toEqual([{ lot: 'Gazon', offers: 2, best: { alias: 'Fournisseur B', total: 51254 } }, { lot: 'Padel', offers: 1, best: { alias: 'Fournisseur A', total: 89000 } }, { lot: 'Set complet', offers: 1, best: { alias: 'Fournisseur A', total: 196028 } }]);
  });
});
