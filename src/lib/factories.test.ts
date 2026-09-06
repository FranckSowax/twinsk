import { describe, expect, it } from 'vitest';
import { apercuDossier, credit_rang, FactoryImportError, parseDossier } from './factories';

const DOSSIER = {
  meta: {
    objet: 'Usines 1688 du poste de musculation complet',
    genere_le: '2026-09-06T13:21:32',
    marche_cible: 'Afrique (import conteneur maritime) — Libreville, Gabon',
    devise: 'CNY',
    classement: 'Capacité industrielle vérifiable et fiabilité commerciale.',
    bassins_industriels: { 'Dingzhou (Hebei)': 'La capitale de la fonte de sport.' },
  },
  usines: [
    {
      rang: 1,
      nom_cn: '河北博烽体育用品有限公司',
      nom_fr: 'Bofeng (Dingzhou, Hebei)',
      atelier_m2: 2200,
      credit_1688: 'AAA — TOP 5 % des marchands',
      note_service: 4.5,
      reachat: '59,8 %',
      labels_1688: ['超级工厂'],
      activite_30j: { commandes_payees: 734 },
    },
    {
      rang: 4,
      nom_fr: 'Jingpu (Dingzhou, Hebei)',
      cree_en: null,
      credit_1688: 'non relevé',
      note_service: null,
      reachat: '42 %',
      fiche_retenue: { offer_id: '1064006069472', prix_cny_par_kg: 9.5 },
    },
  ],
  ecartes: [{ nom_cn: '德州亿峰体育科技有限公司', motif: 'Usage de marque déposée.' }],
  a_demander_a_chaque_usine: ['Le port intérieur chinois jusqu’au port de chargement.'],
};

describe('parseDossier', () => {
  it('refuse un JSON sans tableau usines, ou avec un tableau vide', () => {
    expect(() => parseDossier({ meta: {} })).toThrow(FactoryImportError);
    expect(() => parseDossier({ usines: [] })).toThrow(FactoryImportError);
  });

  it('reprend la méta, compte les usines et les écartés, conserve le payload', () => {
    const { dossier, factories } = parseDossier(DOSSIER);
    expect(dossier.label).toBe('Usines 1688 du poste de musculation complet');
    expect(dossier.devise).toBe('CNY');
    expect(dossier.factory_count).toBe(2);
    expect(dossier.ecarte_count).toBe(1);
    expect(Object.keys(dossier.bassins)).toHaveLength(1);
    expect(dossier.a_demander).toHaveLength(1);
    expect(dossier.payload).toBe(DOSSIER);
    expect(factories).toHaveLength(2);
  });

  it('normalise crédit, réachat et surface pour le tri, sans rien inventer', () => {
    const [premier, quatrieme] = parseDossier(DOSSIER).factories;
    expect(premier.credit_rang).toBe(3);
    expect(premier.reachat_pct).toBe(59.8);
    expect(premier.atelier_m2).toBe(2200);
    expect(premier.note_service).toBe(4.5);
    expect(quatrieme.credit_rang).toBeNull(); // « non relevé » ne devient pas un A
    expect(quatrieme.note_service).toBeNull();
    expect(quatrieme.cree_en).toBeNull();
    expect(quatrieme.reachat_pct).toBe(42);
    expect(quatrieme.fiche_retenue).toEqual({ offer_id: '1064006069472', prix_cny_par_kg: 9.5 });
  });

  it('accepte un libellé saisi à l’import et tronque un objet trop long', () => {
    expect(parseDossier(DOSSIER, '  Musculation club  ').dossier.label).toBe('Musculation club');
    const long = { ...DOSSIER, meta: { ...DOSSIER.meta, objet: 'x'.repeat(300) } };
    expect(parseDossier(long).dossier.label.length).toBe(160);
  });

  it('lit une date de génération sans fuseau, ou la laisse nulle', () => {
    expect(parseDossier(DOSSIER).dossier.genere_le).not.toBeNull();
    const flou = { ...DOSSIER, meta: { ...DOSSIER.meta, genere_le: 'hier' } };
    expect(parseDossier(flou).dossier.genere_le).toBeNull();
  });
});

describe('credit_rang', () => {
  it('classe AAA > AA > A et ignore ce qui n’est pas une note', () => {
    expect(credit_rang('AAA — TOP 5 % des marchands')).toBe(3);
    expect(credit_rang('AA — TOP 20 % des marchands')).toBe(2);
    expect(credit_rang('A')).toBe(1);
    expect(credit_rang('non relevé')).toBeNull();
    expect(credit_rang(null)).toBeNull();
  });
});

describe('apercuDossier', () => {
  it('compte sans écrire, et rend null si la forme ne convient pas', () => {
    expect(apercuDossier(DOSSIER)).toEqual({
      usines: 2,
      ecartes: 1,
      bassins: 1,
      objet: 'Usines 1688 du poste de musculation complet',
    });
    expect(apercuDossier({ categories: [] })).toBeNull();
  });
});
