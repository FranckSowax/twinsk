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

// Returns a short, denomination-only version of a long product title.
// Stops at the first major punctuation (comma, colon, dash, parenthesis) so
// "Sac à main classique cuir véritable noir 35cm, double anse zip" becomes
// "Sac à main classique cuir…".
// Limits to a max number of words and appends an ellipsis if truncated.
export function shortenTitle(input: string | null | undefined, maxWords = 5): string {
  if (!input || typeof input !== 'string') return '';
  const cleaned = sanitizeForPublic(input);
  if (!cleaned) return '';
  // Cut at the first major punctuation
  const cut = cleaned.split(/[,.;:—–\-(]/)[0].trim();
  if (!cut) return cleaned;
  const words = cut.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return cut;
  return words.slice(0, maxWords).join(' ') + '…';
}
