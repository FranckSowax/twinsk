import { describe, expect, it } from 'vitest';
import { buildSourcingBrief, identifyingTokens, SOURCING_BRIEF_FORMAT, validateSourcingImport } from './sourcing';

const result = {
  format: 'twinsk-sourcing-v1',
  project: 'PSG',
  lots: [
    {
      lot: 'gazon',
      elements: [
        {
          element: 'Gazon non-infill 30 mm',
          suppliers: [
            {
              rank: 1, real_name: 'Taishan Turf', city: 'Leling', website: 'https://www.taishanturf.com', email: 'sales@taishanturf.com', whatsapp: '+86 138 0000 0000', preferred_channel: 'EMAIL', contact_source: 'https://www.taishanturf.com/contact', confidence: 'high', status: 'selected',
              scores: { certifications: { score: 4, why: 'ISO + SGS' }, climate: 4, installation: 3, price: 5.4, transparency: '4' },
              description: 'Groupe fondé en 1978, capacité 120 000 m²/jour.', product_specs: [{ label: 'Hauteur', value: '30 mm' }, { label: 'Marque', value: 'Taishan PIKE' }],
              certifications: ['ISO 9001', 'SGS'], years_experience: '48', indicative_price: { min: 4.8, max: 5, currency: 'usd', unit: 'm²', incoterm: 'FOB' }, risks: ['Gamme FIFA plus chère'], sources: ['https://www.taishanturf.com'],
            },
            { rank: 2, real_name: 'AVG', description: 'Fabricant AVG depuis 1982, site avg1982.com.', scores: {} },
            { rank: 3, real_name: 'Taishan Turf' },
            { rank: 4, city: 'x' },
          ],
        },
      ],
    },
    { lot: 'Drones', suppliers: [{ real_name: 'DJI' }] },
  ],
};

describe('import du résultat du skill de sourcing', () => {
  const r = validateSourcingImport(result, { knownLots: ['Gazon', 'Padel'] });
  it('usines normalisées : lot rapproché, notes bornées, alias de critère, prix mis en forme, retenue → présélectionnée', () => {
    expect(r.suppliers.map((s) => `${s.lot}/${s.real_name}`)).toEqual(['Gazon/Taishan Turf', 'Gazon/AVG', 'Drones/DJI']);
    const t = r.suppliers[0];
    expect(t).toMatchObject({ status: 'shortlisted', preferred_channel: 'email', scores: { certifications: 4, tropical: 4, installation: 3, price: 5, transparency: 4 }, years_experience: 48, indicative_price: '4.8–5 USD/m² FOB', country: 'Chine', element: 'Gazon non-infill 30 mm' });
    expect(t.contact_source).toBe('https://www.taishanturf.com/contact — confiance high');
    expect(t.internal_note).toContain('Notation — certifications : ISO + SGS');
    expect(t.internal_note).toContain('Risques : Gamme FIFA plus chère');
    expect(r.byLot).toEqual({ Gazon: 2, Drones: 1 });
  });
  it('fiche client protégée : description ou caractéristique identifiante retirée, avertissements', () => {
    expect(r.suppliers[0].description).toBe('Groupe fondé en 1978, capacité 120 000 m²/jour.');
    expect(r.suppliers[0].product_specs).toEqual([{ label: 'Hauteur', value: '30 mm' }]);
    expect(r.suppliers[1].description).toBeNull();
    expect(r.warnings.join('\n')).toMatch(/AVG : description retirée/);
    expect(r.warnings.join('\n')).toMatch(/Taishan Turf \(Gazon\) : doublon ignoré/);
    expect(r.warnings.join('\n')).toMatch(/nom manquant/);
    expect(r.warnings.join('\n')).toMatch(/lot « Drones » absent du projet/);
    expect(identifyingTokens({ real_name: 'Shenzhen LDK Industrial Co', website: 'ldkchina.com', city: 'Shenzhen' })).toEqual(['shenzhen', 'ldk', 'ldkchina']);
    const avg = validateSourcingImport([{ lot: 'Gazon', real_name: 'AVG', description: 'Average lead time 20 days.' }]);
    expect(avg.suppliers[0].description).toBe('Average lead time 20 days.');
  });
  it('formats tolérés : liste plate, JSON vide', () => {
    expect(validateSourcingImport([{ lot: 'Padel', real_name: 'PanoCourt' }]).suppliers).toHaveLength(1);
    expect(validateSourcingImport({}).warnings).toEqual(['Aucune usine trouvée dans le JSON.']);
    expect(validateSourcingImport({ format: 'autre', suppliers: [{ lot: 'A', name: 'B' }] }).warnings[0]).toMatch(/inattendu/);
  });
});

describe('besoin de sourcing exporté', () => {
  it('lots, lignes, exigences et usines connues', () => {
    const b = buildSourcingBrief({
      title: 'PSG', description: null, currency: 'USD', phases: [{ sites: ['Martinique', 'Guadeloupe'] }, { sites: ['Guyane'] }],
      lines: [{ lot: 'Gazon', label: 'Gazon 30 mm', unit: 'm²', quantity: 5800, optional: false }, { lot: 'Options', label: 'Tribune', unit: 'pièce', quantity: 8, optional: true }],
      rfq: [{ lot: 'Gazon', product_en: 'Non-infill turf', quantities_en: '5,800 m²', requirements_en: ['UV ≥ 5,000 h'] }],
      rfqContext: { project_en: 'Sports complexes', requirements_en: ['C5-M'] },
      knownSuppliers: [{ lot: 'Gazon', real_name: 'Taishan Turf' }, { lot: 'Gazon', real_name: null }], lots: ['Gazon', 'Cages'],
    });
    expect(b.format).toBe(SOURCING_BRIEF_FORMAT);
    expect(b.sites).toEqual(['Martinique', 'Guadeloupe', 'Guyane']);
    expect(b.lots.map((l) => l.lot)).toEqual(['Gazon', 'Options']);
    expect(b.lots[0]).toMatchObject({ product_en: 'Non-infill turf', requirements: ['UV ≥ 5,000 h'], already_known: ['Taishan Turf'] });
    expect(b.common_requirements).toEqual(['C5-M']);
    expect(b.suppliers_per_element).toBe(3);
  });
});
