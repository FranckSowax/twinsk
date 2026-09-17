// Regroupement des lignes de devis pour l'affichage : un produit dont
// plusieurs variantes sont retenues s'affiche UNE fois (titre en gras +
// description), puis une ligne par variante (nom en gras sur bandeau bleu,
// prix, quantité, total) — sans répéter la description.

export interface GroupableItem {
  product_key?: string | null;
  variant_name?: string | null;
}

export type QuoteGroup<T extends GroupableItem> =
  | { kind: 'single'; item: T }
  | { kind: 'variants'; product: T; variants: T[] };

export function groupQuoteItems<T extends GroupableItem>(items: T[]): QuoteGroup<T>[] {
  const out: QuoteGroup<T>[] = [];
  for (const it of items) {
    if (it.variant_name && it.product_key) {
      const last = out[out.length - 1];
      if (last && last.kind === 'variants' && last.product.product_key === it.product_key) {
        last.variants.push(it);
        continue;
      }
      out.push({ kind: 'variants', product: it, variants: [it] });
      continue;
    }
    out.push({ kind: 'single', item: it });
  }
  return out;
}
