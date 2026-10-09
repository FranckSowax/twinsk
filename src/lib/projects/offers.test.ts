import { describe, expect, it } from 'vitest';
import { cleanItem, compareOffer, type CompareItem, formatTiers, offerFromExtracted, formatVariant, offerLayout, parseTiers, parseVariant, priceOffer, projectLine, projectQty, sellPrice, tierColumns, unitCostAt, unitKey, validateExtractedOffer, variantKeys, type OfferItem } from './offers';

const item = (o: Partial<OfferItem>): OfferItem => cleanItem({ label: 'Gazon', unit: 'm²', price: 4.9, ...o })!;

describe('prix reçus : paliers, marge, conversion', () => {
  it('palier le plus haut atteint ; sous le premier palier : prix de base ou premier palier signalé', () => {
    const t = item({ price: null, tiers: [{ min_qty: 5000, price: 4.6 }, { min_qty: 2000, price: 4.9 }] });
    expect(t.tiers.map((x) => x.min_qty)).toEqual([2000, 5000]);
    expect(unitCostAt(t, 5800)).toMatchObject({ price: 4.6, belowMin: false });
    expect(unitCostAt(t, 3000)).toMatchObject({ price: 4.9 });
    expect(unitCostAt(t, 1000)).toMatchObject({ price: 4.9, belowMin: true });
    expect(unitCostAt(item({ price: 5.2, tiers: [{ min_qty: 2000, price: 4.9 }] }), 1000)).toMatchObject({ price: 5.2, belowMin: false });
  });
  it('marge : % par défaut du projet, % de l’offre, ou somme fixe par unité', () => {
    expect(sellPrice(10, { mode: 'pct', value: null }, 25)).toBe(12.5);
    expect(sellPrice(10, { mode: 'pct', value: 30 }, 25)).toBe(13);
    expect(sellPrice(10, { mode: 'amount', value: 1.75 }, 25)).toBe(11.75);
    expect(sellPrice(null, { mode: 'pct', value: 30 }, 25)).toBeNull();
  });
  it('offre en yuans : convertie en dollars, marge appliquée, total à la quantité du projet, frais une fois', () => {
    const items = [item({ id: 'g', price: 35 }), cleanItem({ id: 'f', kind: 'fee', label: 'Échantillons', price: 700 })!];
    const p = priceOffer({ items, currency: 'CNY', margin: { mode: 'pct', value: null } }, { base: 'USD', rates: { CNY: 0.14 }, defaultPct: 25, qtyOf: (i) => (i.kind === 'fee' ? null : 5800) });
    expect(p[0]).toMatchObject({ cost: 35, costBase: 4.9, sell: 6.13, totalSell: 35554 });
    expect(p[1]).toMatchObject({ cost: 700, costBase: 98, sell: 122.5, totalSell: 122.5 });
  });
});

describe('prix reçus : affichage adapté et saisie rapide', () => {
  it('disposition : simple, variantes, paliers, variantes + paliers', () => {
    expect(offerLayout([item({})])).toBe('simple');
    expect(offerLayout([item({ variant: { Hauteur: '30 mm' } }), item({ variant: { Hauteur: '40 mm' } })])).toBe('variants');
    expect(offerLayout([item({ tiers: [{ min_qty: 1, price: 5 }, { min_qty: 5000, price: 4.6 }] })])).toBe('tiers');
    const vt = [item({ variant: { Hauteur: '30 mm' }, tiers: [{ min_qty: 2000, price: 4.9 }, { min_qty: 5000, price: 4.6 }] }), item({ variant: { Hauteur: '40 mm' }, tiers: [{ min_qty: 2000, price: 5.4 }] })];
    expect(offerLayout(vt)).toBe('variants_tiers');
    expect(variantKeys(vt)).toEqual(['Hauteur']);
    expect(tierColumns(vt)).toEqual([2000, 5000]);
  });
  it('saisie : variantes et paliers en texte, aller-retour', () => {
    expect(parseVariant('Hauteur=30 mm; Couleur: vert')).toEqual({ Hauteur: '30 mm', Couleur: 'vert' });
    expect(formatVariant({ Hauteur: '30 mm' })).toBe('Hauteur=30 mm');
    expect(parseTiers('5000:4,6; 2000:4.9')).toEqual([{ min_qty: 2000, price: 4.9 }, { min_qty: 5000, price: 4.6 }]);
    expect(formatTiers([{ min_qty: 2000, price: 4.9 }])).toBe('2000:4.9');
    expect(cleanItem({ label: '' , price: 3 })).toBeNull();
    expect(cleanItem({ label: 'X' })).toBeNull();
  });
  it('quantité du projet : ligne liée, sinon même unité dans le lot, sinon seule ligne', () => {
    const lines = [{ id: 'a', lot: 'Gazon', unit: 'm²', effective_quantity: 5800 }, { id: 'b', lot: 'Gazon', unit: 'kit', effective_quantity: 2 }, { id: 'c', lot: 'Padel', unit: 'set', effective_quantity: 8 }];
    expect(projectQty({ quote_line_id: 'b', unit: 'm²' }, 'Gazon', lines)).toBe(2);
    expect(projectQty({ quote_line_id: null, unit: 'M²' }, 'Gazon', lines)).toBe(5800);
    expect(projectQty({ quote_line_id: null, unit: 'pièce' }, 'Padel', lines)).toBe(8);
    expect(projectQty({ quote_line_id: null, unit: 'pièce' }, 'Gazon', lines)).toBeNull();
    // Deux lignes en m² dans le lot : rapprochement par libellé.
    const two = [{ id: 'g', lot: 'Gazon', unit: 'm²', label: 'Gazon synthétique non-infill', effective_quantity: 5800 }, { id: 's', lot: 'Gazon', unit: 'm²', label: 'Sous-couche shockpad', effective_quantity: 4800 }];
    expect(projectQty({ quote_line_id: null, unit: 'm²', label: 'Shockpad 10 mm' }, 'Gazon', two)).toBe(4800);
    expect(projectQty({ quote_line_id: null, unit: 'm²', label: 'TS PIKE gazon 30 mm' }, 'Gazon', two)).toBe(5800);
  });
  it('lot sans ligne (usine « set complet ») : toutes les lignes, unités équivalentes, libellé obligatoire', () => {
    const lines = [
      { id: 'p', lot: 'Padel', unit: 'kit', label: 'Kit padel panoramique 20 × 10 m', effective_quantity: 8 },
      { id: 'c', lot: 'Cages', unit: 'kit', label: 'Kit cages foot 5 avec clôture', effective_quantity: 8 },
      { id: 'g', lot: 'Gazon', unit: 'm²', label: 'Gazon synthétique non-infill (foot five)', effective_quantity: 5800 },
      { id: 's', lot: 'Gazon', unit: 'm²', label: 'Shockpad', effective_quantity: 4800 },
    ];
    const lot = 'Set complet foot & padel';
    expect(projectLine({ quote_line_id: null, unit: 'set', label: 'Court de padel panoramique 20×10 m — kit complet' }, lot, lines)?.id).toBe('p');
    expect(projectLine({ quote_line_id: null, unit: 'field', label: 'LDK20017E Cage de foot 5 style Euro 30 × 20 × 4 m' }, lot, lines)?.id).toBe('c');
    expect(projectLine({ quote_line_id: null, unit: 'M2', label: 'Gazon synthétique foot 50 mm' }, lot, lines)?.id).toBe('g');
    expect(projectLine({ quote_line_id: null, unit: 'm2', label: 'Shock pad XPE 10 mm' }, lot, lines)?.id).toBe('s');
    // Aucun mot en commun ou pas de libellé : pas de rattachement par défaut hors du lot.
    expect(projectLine({ quote_line_id: null, unit: 'kit', label: 'Buts amovibles' }, lot, lines)).toBeNull();
    expect(projectLine({ quote_line_id: null, unit: 'tonne', label: 'Granulés SBR' }, lot, lines)).toBeNull();
    expect(projectLine({ quote_line_id: null, unit: 'set' }, lot, lines)).toBeNull();
    expect(unitKey('Sets')).toBe('kit');
    expect(unitKey('pièces')).toBe('pièce');
    expect(unitKey('sqm')).toBe('m²');
  });
  it('offre extraite d’un message : devise, incoterm, lignes ; null sans prix', () => {
    const o = validateExtractedOffer({ currency: 'usd', incoterm: 'fob', port: 'Qingdao', valid_until: '2026-10-31', items: [{ label: 'TS PIKE 30A', unit: 'm²', tiers: [{ min_qty: 2000, price: 4.9 }] }, { kind: 'option', label: 'Lignes tuftées', unit: 'm²', price: '0,30' }, { label: 'sans prix' }] })!;
    expect(o).toMatchObject({ currency: 'USD', incoterm: 'FOB', port: 'Qingdao', valid_until: '2026-10-31' });
    expect(o.items.map((i) => [i.kind, i.label, i.price])).toEqual([['base', 'TS PIKE 30A', null], ['option', 'Lignes tuftées', 0.3]]);
    expect(validateExtractedOffer({ items: [] })).toBeNull();
  });
});

describe('comparaison d’offres', () => {
  it('alternatives sur une même ligne (moins chère ou variante filtrée), lignes différentes additionnées, frais ajoutés', () => {
    const items: CompareItem[] = [
      { id: 'a', kind: 'base' as const, label: 'Gazon 30', variant: { Hauteur: '30 mm' }, line_id: 'g', price: 6.13, total: 35554 },
      { id: 'b', kind: 'base' as const, label: 'Gazon 40', variant: { Hauteur: '40 mm' }, line_id: 'g', price: 6.75, total: 39150 },
      { id: 'c', kind: 'base' as const, label: 'Shockpad', variant: {}, line_id: 's', price: 3.25, total: 15600 },
      { id: 'f', kind: 'fee' as const, label: 'Échantillons', variant: {}, line_id: null, price: 100, total: 100 },
      { id: 'o', kind: 'option' as const, label: 'Lignes', variant: {}, line_id: 'g', price: 0.38, total: 2204 },
    ];
    expect(compareOffer(items)).toMatchObject({ total: 51254, fees: 100, complete: true });
    expect(compareOffer(items).byLine.g.id).toBe('a');
    expect(compareOffer(items, { Hauteur: '40 mm' }).byLine.g.id).toBe('b');
    expect(compareOffer(items, { Hauteur: '40 mm' }).total).toBe(54850);
    expect(compareOffer([{ ...items[0], total: null }]).total).toBeNull();
  });
});

describe('prix d’un message → offre enregistrée', () => {
  it('titre daté de l’échange, conditions et lignes reprises telles quelles', () => {
    const extracted = validateExtractedOffer({ currency: 'usd', incoterm: 'exw', port: 'Shenzhen', lead_time: '25 jours', items: [{ label: 'Cage de foot', unit: 'set', price: 11500 }] })!;
    const o = offerFromExtracted(extracted, '2026-10-09T08:30:00Z');
    expect(o.title).toBe('Prix reçus le 9 oct. 2026');
    expect(o).toMatchObject({ currency: 'USD', incoterm: 'EXW', port: 'Shenzhen', lead_time: '25 jours' });
    expect(o.items).toBe(extracted.items);
    // Date absente ou illisible : titre du jour, jamais « Invalid Date ».
    expect(offerFromExtracted(extracted, 'pas une date').title).toMatch(/^Prix reçus le \d/);
    expect(offerFromExtracted(extracted, null).title).toMatch(/^Prix reçus le \d/);
  });
});
