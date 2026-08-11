/**
 * Les descriptions produit du catalogue sont redigees en markdown (**gras**,
 * titres ##, listes, liens). Un PDF react-pdf n interprete rien : le markdown
 * ressortait tel quel (« **1 000 × 1 000 × 30 mm** »). On aplatit en texte brut.
 */
export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ') // blocs de code
    .replace(/`([^`]+)`/g, '$1') // code inline
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // liens -> libelle
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // titres
    .replace(/^\s{0,3}>\s?/gm, '') // citations
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '• ') // listes
    .replace(/^\s{0,3}([-*_])\s*(\1\s*){2,}$/gm, ' ') // separateurs ---
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // gras
    .replace(/(?<![*\w])(\*|_)(?!\s)([^*_]+?)(?<!\s)\1(?![*\w])/g, '$2') // italique
    .replace(/~~(.*?)~~/g, '$1') // barre
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/**
 * Tronque sur une frontiere de mot (le PDF coupait en plein milieu d un mot,
 * ex. « 26 kg par m² en 30 mm… »).
 */
export function truncateOnWord(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}
