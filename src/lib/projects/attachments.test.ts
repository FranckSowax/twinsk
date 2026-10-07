import { describe, expect, it } from 'vitest';
import { cleanPdfText, decodeEncodedWords, docsPromptText, docSummary, DOC_TEXT_MAX, htmlToText, isScanned, parseEml, type ReadDoc } from './attachments';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

describe('e-mail .eml : corps, en-têtes codés, pièces jointes', () => {
  const eml = [
    'From: =?UTF-8?B?Q29sb21iZSDigJQgTERL?= <cathy@ldkchina.com>',
    'To: franck@twinsk.com',
    'Subject: =?utf-8?Q?Quotation_padel_=E2=82=AC?=',
    'Date: Tue, 7 Oct 2026 10:00:00 +0800',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="MIX"',
    '',
    'préambule ignoré',
    '--MIX',
    'Content-Type: multipart/alternative; boundary="ALT"',
    '',
    '--ALT',
    'Content-Type: text/plain; charset=iso-8859-1',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Hello dear=EF=BC=9A',
    'Please check the quotation about your soccer cage=',
    ' and padel court.',
    '--ALT',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<html><body><p>Hello <b>dear</b></p><ul><li>padel</li></ul></body></html>',
    '--ALT--',
    '--MIX',
    'Content-Type: application/pdf; name="quote.pdf"',
    'Content-Transfer-Encoding: base64',
    "Content-Disposition: attachment; filename*=utf-8''2026.10.7%20LDK%20Padel%20%C3%A9.pdf",
    '',
    b64('%PDF-1.4 fake'),
    '--MIX',
    'Content-Type: image/png',
    'Content-Disposition: inline; filename="capture.png"',
    'Content-Transfer-Encoding: base64',
    '',
    b64('PNG'),
    '--MIX--',
    'épilogue',
  ].join('\r\n');

  it('corps text/plain préféré au HTML, quoted-printable décodé, pièces jointes nommées et décodées', () => {
    const m = parseEml(eml);
    expect(m.subject).toBe('Quotation padel €');
    expect(m.from).toBe('Colombe — LDK <cathy@ldkchina.com>');
    expect(m.text).toContain('Please check the quotation about your soccer cage and padel court.');
    expect(m.text).not.toContain('<b>');
    expect(m.attachments.map((a) => [a.name, a.mime, a.data.toString('utf8')])).toEqual([
      ['2026.10.7 LDK Padel é.pdf', 'application/pdf', '%PDF-1.4 fake'],
      ['capture.png', 'image/png', 'PNG'],
    ]);
  });
  it('sans partie texte : le HTML converti sert de corps ; message simple non MIME', () => {
    const html = parseEml('Subject: x\r\nContent-Type: text/html\r\n\r\n<p>Prix : 4.9 USD/m&sup2;</p><p>FOB</p>');
    expect(html.text).toBe('Prix : 4.9 USD/m²\nFOB');
    const plain = parseEml('Subject: hi\r\n\r\nJust text\r\n\r\n\r\nend');
    expect(plain.text).toBe('Just text\n\nend');
    expect(plain.attachments).toEqual([]);
  });
  it('mots codés RFC 2047 (B et Q) et HTML → texte (listes, liens, entités)', () => {
    expect(decodeEncodedWords('=?UTF-8?B?w6l0w6k=?= =?UTF-8?Q?2026?=')).toBe('été2026');
    expect(htmlToText('<div>Un&nbsp;<a href="https://x.y">lien</a><br>ligne 2</div><li>a</li><li>b</li>')).toBe('Un lien (https://x.y)\nligne 2\n• a\n• b');
  });
});

describe('PDF : nettoyage du texte, détection d’un scan', () => {
  it('pieds de page répétés gardés une fois, espaces normalisés', () => {
    const raw = ['QUOTATION   SHEET', 'www.ldkchina.com', 'Item 1   9900/SET', 'www.ldkchina.com', '', '', '', 'www.ldkchina.com', 'Total', '-- 1 of 1 --', 'www.ldkchina.com'].join('\n');
    expect(cleanPdfText(raw)).toBe('QUOTATION SHEET\nwww.ldkchina.com\nItem 1 9900/SET\n\nTotal');
  });
  it('scan : presque aucun mot par page ; devis d’une page avec 300 mots : lisible', () => {
    expect(isScanned('', 3)).toBe(true);
    expect(isScanned('a b c', 1)).toBe(true);
    expect(isScanned(Array.from({ length: 300 }, (_, i) => `mot${i}`).join(' '), 1)).toBe(false);
  });
});

describe('mise en forme pour le modèle', () => {
  const doc = (name: string, text: string, extra: Partial<ReadDoc> = {}): ReadDoc => ({ name, kind: 'pdf', pages: 1, text, scanned: false, note: null, ...extra });
  it('numérote, nomme, coupe chaque pièce et le total ; les pièces sans texte sont omises', () => {
    const long = 'x'.repeat(DOC_TEXT_MAX + 50);
    const t = docsPromptText([doc('a.pdf', 'Prix 9900/set'), doc('scan.pdf', '', { scanned: true }), doc('b.pdf', long)]);
    expect(t).toContain('=== Pièce jointe 1 — « a.pdf » (PDF, 1 p.) ===\nPrix 9900/set');
    expect(t).not.toContain('scan.pdf');
    expect(t).toContain('=== Pièce jointe 3 — « b.pdf »');
    expect(t).toContain('[… coupé, 50 caractères non transmis]');
  });
  it('résumé d’une pièce pour l’équipe', () => {
    expect(docSummary(doc('devis.pdf', 'abc', { pages: 2 }))).toBe('devis.pdf (PDF, 2 pages) — 3 car.');
    expect(docSummary(doc('scan.pdf', '', { scanned: true }))).toBe('scan.pdf (PDF, 1 page) — scanné, lu par OCR');
    expect(docSummary(doc('x.docx', '', { kind: 'other', pages: null, note: 'format Word non lu' }))).toBe('x.docx (fichier) — format Word non lu');
  });
});
