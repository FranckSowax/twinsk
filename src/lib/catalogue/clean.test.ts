import { describe, it, expect } from 'vitest';
import { nettoyer } from './clean';
import type { Catalogue, CatalogueProduct } from './types';

// Enveloppe minimale : 1 catégorie titrée, devise CNY, 1 produit.
function cat(product: CatalogueProduct): Catalogue {
  return { meta: { currency: 'CNY' }, categories: [{ title: 'Test', products: [product] }] };
}
const clean = (p: CatalogueProduct) => {
  const r = nettoyer(cat(p));
  return { p: r.catalogue.categories![0].products![0], r };
};

describe('nettoyer — 7 cas réels', () => {
  it('1. dict {1,1,1} masquant → purgé, "200x48x100 cm" retenu', () => {
    const { p } = clean({
      title: 'Étagère',
      price: 100,
      product_url: 'https://detail.1688.com/offer/1.html',
      dimensions_cm: { l: 1, w: 1, h: 1 },
      dimensions: '200x48x100',
    });
    expect(p.dimensions_cm).toBe('200x48x100 cm');
    expect(p.dimensions).toBe('200x48x100 cm');
  });

  it('2. « Balance 30 à 1000 kg » → aucun poids déduit, part en demande', () => {
    const { p, r } = clean({
      title: 'Balance industrielle',
      price: 500,
      product_url: 'https://detail.1688.com/offer/2.html',
      variants: [{ name: 'Balance 30 à 1000 kg' }],
    });
    expect(p.weight_kg).toBeUndefined();
    expect(p.variants![0].weight_kg).toBeUndefined();
    expect(r.demandes.some((d) => d.offer_id === '2')).toBe(true);
  });

  it('3. produit weight 0.06 + variante « 60 kg » → produit ET variante à 60', () => {
    const { p } = clean({
      title: 'Moteur électrique',
      price: 800,
      product_url: 'https://detail.1688.com/offer/3.html',
      weight: 0.06,
      variants: [{ name: 'Version 3,5 kW 60 kg' }],
    });
    expect(p.weight_kg).toBe(60);
    expect(p.variants![0].weight_kg).toBe(60);
  });

  it('3bis. variante commençant par un chiffre (« 60 kg … ») → poids lu (pas confondu avec le séparateur)', () => {
    const { p } = clean({
      title: 'Moteur',
      price: 800,
      product_url: 'https://detail.1688.com/offer/3b.html',
      weight: 0.06,
      variants: [{ name: '60 kg 3,5kW' }],
    });
    expect(p.variants![0].weight_kg).toBe(60);
    expect(p.weight_kg).toBe(60);
  });

  it('4. accessoire (cbm 0.0002, dims 20.3x9.3x1, 0.05 kg) → aucune anomalie', () => {
    const { r } = clean({
      title: 'Support silicone',
      price: 12,
      product_url: 'https://detail.1688.com/offer/4.html',
      cbm: 0.0002,
      dimensions_cm: '20.3x9.3x1 cm',
      weight_kg: 0.05,
    });
    expect(r.anomalies).toEqual([]);
  });

  it('5. carton > machine (dims 85x68x85, volume 0.8349) → pas d’incohérence dims/volume', () => {
    const { r } = clean({
      title: 'Four à convoyeur',
      price: 9000,
      product_url: 'https://detail.1688.com/offer/5.html',
      dimensions_cm: '85x68x85 cm',
      volume: 0.8349,
      weight_kg: 250, // densité ~300 kg/m³, plausible → isole le test sur dims/volume
    });
    expect(r.anomalies.filter((a) => a.code === 'dims_vs_volume_incoherent')).toEqual([]);
    expect(r.anomalies).toEqual([]);
  });

  it('6. variante weight_kg:12 seul → ressort avec weight_kg ET weight à 12', () => {
    const { p } = clean({
      title: 'Pièce',
      price: 30,
      product_url: 'https://detail.1688.com/offer/6.html',
      variants: [{ name: 'A', weight_kg: 12 }],
    });
    expect(p.variants![0].weight_kg).toBe(12);
    expect(p.variants![0].weight).toBe(12);
  });

  it('7. 3 SKU/4 en 定金 → price_type acompte sur produit + 4 variantes, prix inchangés', () => {
    const { p } = clean({
      title: 'Ligne de production',
      price: 5000,
      product_url: 'https://detail.1688.com/offer/7.html',
      variants: [
        { name: '定金 modèle A', price: 5000 },
        { name: '定金 modèle B', price: 6000 },
        { name: '定金 modèle C', price: 7000 },
        { name: 'modèle D', price: 8000 },
      ],
    });
    expect(p.price_type).toBe('acompte');
    expect(p.variants!.every((v) => v.price_type === 'acompte')).toBe(true);
    expect(p.variants!.map((v) => v.price)).toEqual([5000, 6000, 7000, 8000]);
  });
});

describe('nettoyer — garde-fous & bornes', () => {
  it('devise ≠ CNY → blocage', () => {
    const r = nettoyer({ meta: { currency: 'EUR' }, categories: [] });
    expect(r.blocking.some((b) => b.code === 'devise_invalide')).toBe(true);
  });
  it('prix 0/absent → blocage non silencieux', () => {
    const r = nettoyer(cat({ title: 'X', price: 0, product_url: 'https://detail.1688.com/offer/9.html' }));
    expect(r.blocking.some((b) => b.code === 'prix_absent_ou_nul')).toBe(true);
  });
  it('catégorie sans titre → dérivée de name', () => {
    const r = nettoyer({ meta: { currency: 'CNY' }, categories: [{ name: 'Cuisson', products: [] }] });
    expect(r.catalogue.categories![0].title).toBe('Cuisson');
  });
  it('poids sentinelle 9999 purgé', () => {
    const { p } = clean({ title: 'Y', price: 10, product_url: 'https://detail.1688.com/offer/10.html', weight: 9999 });
    expect(p.weight_kg).toBeUndefined();
    expect(p.weight).toBeUndefined();
  });
  it('mm → cm (÷10)', () => {
    const { p } = clean({ title: 'Z', price: 10, product_url: 'https://detail.1688.com/offer/11.html', dimensions: '500x400x300 mm' });
    expect(p.dimensions_cm).toBe('50x40x30 cm');
  });
});
