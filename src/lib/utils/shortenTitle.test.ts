import { describe, expect, it } from 'vitest';
import { shortenTitle } from './shortenTitle';

describe('shortenTitle', () => {
  it("garde l'apostrophe à l'intérieur d'un mot", () => {
    expect(shortenTitle("Canapé d'angle en L compressé sous vide en velours brossé", 5)).toBe("Canapé d'angle en L compressé…");
    expect(shortenTitle('Fauteuil oreilles d’éléphant en cuir', 5)).toBe('Fauteuil oreilles d’éléphant en cuir');
  });

  it("garde le trait d'union et le point à l'intérieur d'un mot", () => {
    expect(shortenTitle('Canapé-lit 2 en 1 compressé sous vide — 5 longueurs', 5)).toBe('Canapé-lit 2 en 1 compressé…');
    expect(shortenTitle('Lit 1.5 m bois massif', 5)).toBe('Lit 1.5 m bois massif');
  });

  it('coupe toujours aux séparateurs', () => {
    expect(shortenTitle('Sac à main classique cuir véritable noir 35cm, double anse zip', 5)).toBe('Sac à main classique cuir…');
    expect(shortenTitle('Table manucure rétro 80 - 200 cm', 5)).toBe('Table manucure rétro 80');
    expect(shortenTitle('Canapé 3 places compressé — 198 cm', 5)).toBe('Canapé 3 places compressé');
    expect(shortenTitle('Lit princesse fille « oreilles de chat » cuir', 5)).toBe('Lit princesse fille');
    expect(shortenTitle('Canapé nuage. Livré compressé', 5)).toBe('Canapé nuage');
  });

  it('vide ou absent', () => {
    expect(shortenTitle('', 5)).toBe('');
    expect(shortenTitle(null)).toBe('');
  });
});
