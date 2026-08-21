/**
 * Intégrité des données d'amorçage (§ 10).
 *
 * Ces données sont extraites du cockpit HTML, pas saisies à la main. Le test
 * fixe les points de vigilance du cahier des charges pour qu'une réextraction
 * ne puisse pas les perdre en silence.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSIETTE_CONDITIONS,
  ASSIETTE_DECISION,
  ASSIETTE_MARKET,
  ASSIETTE_SPEC,
  ASSIETTE_SUPPLIERS,
} from './seed-data';
import { SPEC_ROWS } from './defaults';

const by = (extId: string) => ASSIETTE_SUPPLIERS.find((s) => s.ext_id === extId)!;

describe('panel de l’assiette twist-lock', () => {
  it('les treize fournisseurs attendus, dans l’ordre du dossier', () => {
    expect(ASSIETTE_SUPPLIERS.map((s) => s.ext_id)).toEqual([
      'eelian',
      'picnic',
      'alltime',
      'duytan',
      'changya',
      'laiwell',
      'sharemay',
      'nhibinh',
      'changrong',
      'kelong',
      'jiangsu',
      'fengruosheng',
      'xinchengxin',
    ]);
    expect(ASSIETTE_SUPPLIERS.map((s) => s.position)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('xinchengxin est écarté mais reste au dossier', () => {
    const x = by('xinchengxin');
    expect(x.verdict).toBe('red');
    expect(x.included).toBe(false);
    expect(x.status).toBe('ecarte');
    // La trace du fournisseur écarté et de sa raison fait partie du dossier.
    expect(x.weaknesses.length).toBeGreaterThan(0);
  });

  it('jiangsu et fengruosheng portent le verdict « DD à faire »', () => {
    for (const id of ['jiangsu', 'fengruosheng']) {
      expect(by(id).verdict).toBe('grey');
      expect(by(id).verdict_label).toBe('DD à faire');
    }
  });

  it('les MOQ déjà documentés sont préremplis, les autres restent nuls', () => {
    expect(by('nhibinh').known_moq).toBe(500);
    expect(by('eelian').known_moq).toBe(3000);
    const autres = ASSIETTE_SUPPLIERS.filter((s) => !['nhibinh', 'eelian'].includes(s.ext_id));
    // Un MOQ non documenté reste null : ce n'est pas un MOQ de zéro.
    expect(autres.every((s) => s.known_moq === null)).toBe(true);
  });

  it('les alertes bloquantes sont des données, pas des commentaires', () => {
    const avecAlerte = ASSIETTE_SUPPLIERS.filter((s) => s.warnings.length > 0).map((s) => s.ext_id);
    expect(avecAlerte).toEqual(['picnic', 'duytan', 'sharemay', 'nhibinh', 'jiangsu', 'fengruosheng']);
    // Le domaine sosie de Picnic Plast et l'entité contractante de Duy Tan.
    expect(by('picnic').warnings.join(' ')).toContain('picnicplast.com');
    expect(by('duytan').warnings.join(' ')).toContain('0306151768');
    expect(by('jiangsu').warnings.join(' ')).toContain('registre');
  });

  it('les alertes restent aussi dans le texte intégral, qui n’est pas amputé', () => {
    for (const s of ASSIETTE_SUPPLIERS.filter((x) => x.warnings.length)) {
      const texte = `${s.strengths} ${s.weaknesses}`;
      for (const w of s.warnings) expect(texte).toContain(w);
    }
  });

  it('chaque fiche porte sa due diligence et sa solidité', () => {
    for (const s of ASSIETTE_SUPPLIERS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.registration.length).toBeGreaterThan(0);
      expect(s.strengths.length).toBeGreaterThan(0);
      expect(s.weaknesses.length).toBeGreaterThan(0);
      expect(s.solidity).toBeGreaterThanOrEqual(0);
      expect(s.solidity).toBeLessThanOrEqual(100);
      expect(['A', 'B']).toContain(s.track);
      expect(['green', 'amber', 'grey', 'red']).toContain(s.verdict);
    }
  });

  it('les deux voies sont représentées', () => {
    expect(ASSIETTE_SUPPLIERS.some((s) => s.track === 'A')).toBe(true);
    expect(ASSIETTE_SUPPLIERS.some((s) => s.track === 'B')).toBe(true);
  });
});

describe('cadre du projet', () => {
  it('les huit conditions suspensives, avec leur détail', () => {
    expect(ASSIETTE_CONDITIONS).toHaveLength(8);
    expect(ASSIETTE_CONDITIONS.map((c) => c.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const c of ASSIETTE_CONDITIONS) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.detail.length).toBeGreaterThan(0);
    }
    expect(ASSIETTE_CONDITIONS[0].title).toContain('crédit');
  });

  it('le cahier des charges couvre les neuf caractéristiques', () => {
    expect(ASSIETTE_SPEC.map((r) => r.label)).toEqual([...SPEC_ROWS]);
    expect(ASSIETTE_SPEC[0].value).toContain('228,6 mm');
    expect(ASSIETTE_SPEC[0].tolerance).toContain('± 1,5 mm');
  });

  it('le constat de marché est repris en trois encadrés', () => {
    expect(ASSIETTE_MARKET).toHaveLength(3);
    expect(ASSIETTE_MARKET[0].title).toContain('catalogue');
    for (const b of ASSIETTE_MARKET) expect(b.body.length).toBeGreaterThan(50);
  });

  it('la question qui tranche porte sur une preuve, et ses réponses sont celles du dossier', () => {
    expect(ASSIETTE_DECISION.question).toContain('preuves');
    expect(ASSIETTE_DECISION.question).toContain('229 mm');
    // « — en attente — » est l'état vide du select, pas une réponse.
    expect(ASSIETTE_DECISION.options).toHaveLength(3);
    expect(ASSIETTE_DECISION.options.every((o) => !o.startsWith('—'))).toBe(true);
  });
});
