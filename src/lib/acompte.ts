// Acompte usine (catalogue v3.1) : quand price_type === "acompte", `price` n'est
// PAS un prix de vente mais un montant d'acompte. → pas de calcul automatique
// (total panier, prix × quantité, marge, conversion FCFA finale), badge « Acompte »,
// libellé « Acompte usine », CTA « Demander un devis ». Tolérant aux champs absents.

export const PRICE_TYPE_ACOMPTE = 'acompte';
export const ACOMPTE_LABEL = 'Acompte usine';
export const ACOMPTE_BADGE = 'Acompte';

export function isAcompte(priceType: unknown): boolean {
  return priceType === PRICE_TYPE_ACOMPTE;
}

// Héritage : si le PRODUIT est en acompte, toutes ses variantes le sont aussi,
// même si le champ manque sur la variante.
export function variantIsAcompte(productPriceType: unknown, variantPriceType: unknown): boolean {
  return isAcompte(productPriceType) || isAcompte(variantPriceType);
}
