// Customer-facing text utilities. The data we ingest from 1688/Alibaba often
// references the source marketplace. Customers must NEVER see those mentions.

// Strip references to source marketplaces (1688, Alibaba, Taobao) plus common
// French phrases like "sourcé sur 1688" / "vente en gros". Used in
// fetchPublicOffer and on /proposal so the client only sees clean text.
export function sanitizeForPublic(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  let s = input;
  s = s.replace(/\bsourc[ée]s?\s+sur\s+(?:le\s+site\s+)?1688(?:\.com)?\b/gi, '');
  s = s.replace(/\bdisponibles?\s+sur\s+(?:le\s+site\s+)?1688(?:\.com)?\b/gi, '');
  s = s.replace(/\bsur\s+1688(?:\.com)?\b/gi, '');
  s = s.replace(/\b1688(?:\.com)?\b/gi, '');
  s = s.replace(/\balibaba(?:\.com)?\b/gi, '');
  s = s.replace(/\btaobao(?:\.com)?\b/gi, '');
  // Cleanup orphan punctuation / repeated spaces created by the deletions
  s = s.replace(/\s*,\s*,\s*/g, ', ');
  s = s.replace(/\(\s*,\s*/g, '(');
  s = s.replace(/\s*,\s*\)/g, ')');
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/\s+\./g, '.');
  s = s.replace(/[,—–\-:]\s*$/g, '');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

const HARD_CUTS = new Set([',', ';', ':', '—', '–', '(', '«', '»', '"']);
// Coupent seulement hors d'un mot : « Canapé d'angle », « Canapé-lit » et
// « 1.5 m » restent entiers ; « Lit - bois » ou « 'Nuage' » sont coupés.
const SOFT_CUTS = new Set(['.', "'", '’', '-']);
const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

// Position of the first major punctuation in `s` (s.length if none). Pas de
// lookbehind dans une regex : non supporté avant iOS 16.4.
function titleCutIndex(s: string): number {
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (HARD_CUTS.has(c)) return i;
    if (SOFT_CUTS.has(c) && !(isWordChar(s[i - 1]) && isWordChar(s[i + 1]))) return i;
  }
  return s.length;
}

// Returns a short, denomination-only version of a long product title.
// Stops at the first major punctuation (comma, colon, dash, parenthesis) so
// "Sac à main classique cuir véritable noir 35cm, double anse zip" becomes
// "Sac à main classique cuir…".
// Limits to a max number of words and appends an ellipsis if truncated.
export function shortenTitle(input: string | null | undefined, maxWords = 3): string {
  if (!input || typeof input !== 'string') return '';
  const cleaned = sanitizeForPublic(input);
  if (!cleaned) return '';
  // Cut at the first major punctuation (incl. French / smart quotes)
  const cut = cleaned.slice(0, titleCutIndex(cleaned)).trim();
  if (!cut) return cleaned;
  const words = cut.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return cut;
  return words.slice(0, maxWords).join(' ') + '…';
}

// Split a category description like "Titre court — Longue note explicative"
// into { short, rest }. If no em-dash separator is found, returns the whole
// thing as short. Used by /offer to render a tight bold headline + optional
// small subtitle.
export function splitCategoryTitle(input: string | null | undefined): { short: string; rest: string } {
  if (!input || typeof input !== 'string') return { short: '', rest: '' };
  const cleaned = sanitizeForPublic(input);
  if (!cleaned) return { short: '', rest: '' };
  // Match " — " / " – " / " - " (em, en, hyphen) as separator
  const m = cleaned.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (m) {
    return { short: m[1].trim(), rest: m[2].trim() };
  }
  return { short: cleaned, rest: '' };
}
