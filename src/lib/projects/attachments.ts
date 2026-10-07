// Pièces jointes d'un échange usine lues pour l'analyse (6 oct. 2026) : un
// devis ou une fiche technique en PDF, un e-mail enregistré en .eml (corps et
// PDF joints), un fichier texte. Partie pure, testée : décodage MIME d'un
// e-mail, HTML → texte, mise en forme pour le modèle, détection d'un PDF
// scanné (sans couche de texte, à faire lire par OCR). La lecture du bucket et
// du PDF lui-même (pdf-parse) est dans attachments-server.ts.

export type DocKind = 'pdf' | 'eml' | 'text' | 'image' | 'other';
export interface ReadDoc {
  /** Nom affiché ; une pièce jointe d'un e-mail est préfixée : « mail.eml › devis.pdf ». */
  name: string;
  kind: DocKind;
  pages: number | null;
  /** Texte extrait (vide pour une image, un scan ou un format non lu). */
  text: string;
  /** PDF sans couche de texte : transmis tel quel au modèle, qui le lit par OCR. */
  scanned: boolean;
  /** Pourquoi le texte manque (format Word/Excel, fichier trop gros…), sinon null. */
  note: string | null;
}

/** Texte d'une pièce jointe au-delà duquel on coupe (devis : quelques milliers de caractères). */
export const DOC_TEXT_MAX = 14_000;
/** Total transmis au modèle pour toutes les pièces jointes. */
export const DOCS_TEXT_MAX = 40_000;

// ---- E-mail .eml (RFC 822 / MIME) ----
export interface EmlAttachment {
  name: string;
  mime: string;
  data: Buffer;
}
export interface ParsedEml {
  subject: string;
  from: string;
  to: string;
  date: string;
  /** Corps en texte : text/plain de préférence, sinon le HTML converti. */
  text: string;
  attachments: EmlAttachment[];
}

const unfold = (headerBlock: string) => headerBlock.replace(/\r?\n[ \t]+/g, ' ');
function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of unfold(block).split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    out[k] = out[k] ? `${out[k]}, ${v}` : v;
  }
  return out;
}
/** Paramètres d'un en-tête structuré (« text/plain; charset=utf-8 »), RFC 2231 compris (filename*0*=…). */
function headerParams(value: string): { main: string; params: Record<string, string> } {
  const [main, ...rest] = value.split(';');
  const params: Record<string, string> = {};
  const parts: Record<string, string[]> = {};
  for (const p of rest) {
    const m = /^\s*([^=]+?)(\*\d+)?(\*)?=\s*([\s\S]*?)\s*$/.exec(p);
    if (!m) continue;
    const key = m[1].toLowerCase();
    let v = m[4].replace(/^"([\s\S]*)"$/, '$1');
    if (m[3]) {
      // RFC 2231 : charset'lang'valeur-encodée
      const q = /^([^']*)'[^']*'([\s\S]*)$/.exec(v);
      if (q) v = decodePercent(q[2], q[1] || 'utf-8');
    }
    if (m[2]) (parts[key] ||= [])[Number(m[2].slice(1))] = v;
    else params[key] = v;
  }
  for (const [k, segs] of Object.entries(parts)) params[k] = segs.join('');
  return { main: main.trim().toLowerCase(), params };
}
function decodePercent(s: string, charset: string): string {
  try {
    const bytes = Buffer.from(s.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
    return decodeCharset(bytes, charset);
  } catch {
    return s;
  }
}
function decodeCharset(bytes: Buffer, charset: string): string {
  const cs = (charset || 'utf-8').toLowerCase().replace(/^"|"$/g, '');
  try {
    return new TextDecoder(cs === 'us-ascii' ? 'utf-8' : cs).decode(bytes);
  } catch {
    return bytes.toString('utf8');
  }
}
/** Mots codés RFC 2047 (« =?UTF-8?B?…?= », « =?iso-8859-1?Q?…?= ») dans un en-tête. */
export function decodeEncodedWords(s: string): string {
  return s
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s+(?==\?))?/g, (_, cs: string, enc: string, data: string) => {
      const bytes = enc.toUpperCase() === 'B' ? Buffer.from(data, 'base64') : Buffer.from(data.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
      return decodeCharset(bytes, cs);
    })
    .trim();
}
function decodeBody(raw: string, encoding: string, charset: string): Buffer {
  const enc = (encoding || '7bit').toLowerCase();
  if (enc === 'base64') return Buffer.from(raw.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (enc === 'quoted-printable') {
    const s = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    return Buffer.from(s, 'latin1');
  }
  // 7bit / 8bit / binary : le texte tel quel, dans son jeu de caractères.
  return charset && !/utf-?8/i.test(charset) ? Buffer.from(raw, 'latin1') : Buffer.from(raw, 'utf8');
}

/** HTML → texte lisible : blocs sur des lignes, listes, liens, entités ; scripts et styles retirés. */
export function htmlToText(html: string): string {
  const ent: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ugrave: 'ù', ecirc: 'ê', ocirc: 'ô', icirc: 'î', euro: '€', sup2: '²', sup3: '³', deg: '°', times: '×', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote|pre)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, txt: string) => (txt.replace(/<[^>]+>/g, '').trim() && !/^https?:/.test(txt.trim()) ? `${txt} (${href})` : txt))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n: string) => ent[n.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface MimePart {
  headers: Record<string, string>;
  body: string;
}
function splitMessage(raw: string): MimePart {
  const m = /\r?\n\r?\n/.exec(raw);
  if (!m) return { headers: parseHeaders(raw), body: '' };
  return { headers: parseHeaders(raw.slice(0, m.index)), body: raw.slice(m.index + m[0].length) };
}
function walk(part: MimePart, out: { plain: string[]; html: string[]; attachments: EmlAttachment[] }, depth = 0) {
  if (depth > 8) return;
  const ct = headerParams(part.headers['content-type'] || 'text/plain');
  const cd = headerParams(part.headers['content-disposition'] || '');
  if (ct.main.startsWith('multipart/') && ct.params.boundary) {
    const b = ct.params.boundary;
    const chunks = part.body.split(new RegExp(`\\r?\\n?--${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*(?=\\r?\\n|$)`));
    // Le premier morceau est le préambule, le dernier l'épilogue.
    for (const c of chunks.slice(1, -1)) walk(splitMessage(c.replace(/^\r?\n/, '')), out, depth + 1);
    return;
  }
  if (ct.main === 'message/rfc822') {
    walk(splitMessage(part.body), out, depth + 1);
    return;
  }
  const enc = part.headers['content-transfer-encoding'] || '7bit';
  const filename = decodeEncodedWords(cd.params.filename || ct.params.name || '');
  const isAttachment = cd.main === 'attachment' || (!!filename && !ct.main.startsWith('text/'));
  if (!isAttachment && ct.main === 'text/plain') {
    out.plain.push(decodeCharset(decodeBody(part.body, enc, ct.params.charset || 'utf-8'), ct.params.charset || 'utf-8'));
    return;
  }
  if (!isAttachment && ct.main === 'text/html') {
    out.html.push(htmlToText(decodeCharset(decodeBody(part.body, enc, ct.params.charset || 'utf-8'), ct.params.charset || 'utf-8')));
    return;
  }
  if (filename || ct.main.startsWith('application/') || ct.main.startsWith('image/')) {
    out.attachments.push({ name: filename || `piece-jointe-${out.attachments.length + 1}`, mime: ct.main || 'application/octet-stream', data: decodeBody(part.body, enc, '') });
  }
}

/** Lit un e-mail .eml : en-têtes utiles, corps en texte, pièces jointes décodées. */
export function parseEml(input: Buffer | string): ParsedEml {
  const raw = typeof input === 'string' ? input : input.toString('latin1').startsWith('From ') ? input.toString('utf8') : input.toString('utf8');
  const top = splitMessage(raw.replace(/^From .*\r?\n/, ''));
  const out = { plain: [] as string[], html: [] as string[], attachments: [] as EmlAttachment[] };
  walk(top, out);
  const h = top.headers;
  const text = (out.plain.join('\n\n').trim() || out.html.join('\n\n').trim()).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return {
    subject: decodeEncodedWords(h.subject || ''),
    from: decodeEncodedWords(h.from || ''),
    to: decodeEncodedWords(h.to || ''),
    date: (h.date || '').trim(),
    text,
    attachments: out.attachments,
  };
}

// ---- PDF ----
/** Nettoie le texte d'un PDF : espaces multiples, lignes vides en rafale, pieds de page répétés (adresse web sur chaque page). */
export function cleanPdfText(text: string): string {
  // Séparateurs de pages de pdf-parse (« -- 1 of 3 -- ») : sans valeur pour le modèle.
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter((l) => !/^-- \d+ of \d+ --$/.test(l));
  const counts = new Map<string, number>();
  for (const l of lines) if (l.length >= 8) counts.set(l, (counts.get(l) || 0) + 1);
  const kept: string[] = [];
  const seen = new Map<string, number>();
  for (const l of lines) {
    // Une ligne courte répétée 4 fois ou plus (www.site.com, en-tête de page) n'est gardée qu'une fois.
    if ((counts.get(l) || 0) >= 4 && l.length < 60) {
      const n = (seen.get(l) || 0) + 1;
      seen.set(l, n);
      if (n > 1) continue;
    }
    kept.push(l);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** PDF « scanné » : pas de couche de texte exploitable au regard du nombre de pages. */
export function isScanned(text: string, pages: number | null): boolean {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]{2,}/u.test(w)).length;
  return words < Math.max(20, 12 * (pages || 1));
}

// ---- Mise en forme pour le modèle ----
const KIND_LABEL: Record<DocKind, string> = { pdf: 'PDF', eml: 'e-mail', text: 'texte', image: 'image', other: 'fichier' };
/** Description courte d'une pièce jointe lue (affichée à l'équipe et dans le prompt). */
export function docSummary(d: ReadDoc): string {
  const size = d.kind === 'pdf' && d.pages ? `, ${d.pages} page${d.pages > 1 ? 's' : ''}` : '';
  const state = d.note ? ` — ${d.note}` : d.scanned ? ' — scanné, lu par OCR' : d.text ? ` — ${d.text.length.toLocaleString('fr-FR')} car.` : '';
  return `${d.name} (${KIND_LABEL[d.kind]}${size})${state}`;
}
/**
 * Texte des pièces jointes pour le prompt : numérotées, nommées, coupées à
 * DOC_TEXT_MAX chacune et DOCS_TEXT_MAX en tout (les premières d'abord).
 */
export function docsPromptText(docs: ReadDoc[]): string {
  let budget = DOCS_TEXT_MAX;
  const blocks: string[] = [];
  docs.forEach((d, i) => {
    if (!d.text.trim() || budget <= 0) return;
    const limit = Math.min(DOC_TEXT_MAX, budget);
    const cut = d.text.length > limit;
    const body = cut ? `${d.text.slice(0, limit)}\n[… coupé, ${(d.text.length - limit).toLocaleString('fr-FR')} caractères non transmis]` : d.text;
    budget -= Math.min(d.text.length, limit);
    blocks.push(`=== Pièce jointe ${i + 1} — « ${d.name} » (${KIND_LABEL[d.kind]}${d.pages ? `, ${d.pages} p.` : ''}) ===\n${body}`);
  });
  return blocks.join('\n\n');
}
