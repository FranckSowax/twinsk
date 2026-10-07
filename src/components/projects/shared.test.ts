import { describe, expect, it } from 'vitest';
import { dateShort } from './shared';
import { downloadHref, fileKind } from './shared';

describe('documents : ouvrir ou télécharger', () => {
  it('PDF, images et texte s’ouvrent dans le navigateur ; Word, Excel, e-mail se téléchargent', () => {
    expect(fileKind('Plan-masse.PDF')).toMatchObject({ label: 'PDF', viewable: true });
    expect(fileKind('capture.jpeg')).toMatchObject({ label: 'Image', viewable: true });
    expect(fileKind('devis.xlsx')).toMatchObject({ label: 'Excel', viewable: false });
    expect(fileKind('contrat.docx')).toMatchObject({ label: 'Word', viewable: false });
    expect(fileKind('échange.eml')).toMatchObject({ label: 'E-mail', viewable: false });
    expect(fileKind('archive')).toMatchObject({ label: 'Fichier', viewable: false });
  });
  it('adresse de téléchargement : ?download=1 ajouté proprement', () => {
    expect(downloadHref('/api/projects/public/t/documents/1')).toBe('/api/projects/public/t/documents/1?download=1');
    expect(downloadHref('/x?v=2')).toBe('/x?v=2&download=1');
  });
});

describe('dateShort', () => {
  it('une date seule ne glisse pas à la veille selon le fuseau', () => {
    expect(dateShort('2026-11-07')).toBe('7 nov. 2026');
    expect(dateShort(null)).toBe('—');
  });
});
