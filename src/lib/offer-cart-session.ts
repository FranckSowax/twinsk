// Panier public d'un listing : la commande ouverte EST le panier. Dès l'ajout
// d'un produit, le client arrive sur la page commande (produit + transport) ;
// on mémorise l'id de cette commande dans le navigateur pour retrouver le
// panier quand il revient sur le listing (« Continuer mes achats »).

export interface CartLine {
  productId: string;
  variantId: string | null;
  quantity: number;
}

const storageKey = (offerId: string) => `omg_cart:${offerId}`;

/** Une commande reste un panier tant qu'elle n'est ni payée ni en vérification (miroir de loadEditableOrder). */
export function isOrderOpen(o: { payment_status?: string | null; status?: string | null } | null | undefined): boolean {
  if (!o) return false;
  return o.payment_status !== 'submitted' && o.payment_status !== 'paid' && o.status !== 'paid';
}

export function readStoredOrderId(offerId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(offerId));
  } catch {
    return null; // navigation privée, stockage bloqué…
  }
}

export function writeStoredOrderId(offerId: string, orderId: string): void {
  try {
    window.localStorage.setItem(storageKey(offerId), orderId);
  } catch {
    /* stockage indisponible : le panier vit le temps de la page */
  }
}

export function clearStoredOrderId(offerId: string): void {
  try {
    window.localStorage.removeItem(storageKey(offerId));
  } catch {
    /* idem */
  }
}

export const cartKey = (productId: string, variantId: string | null) => `${productId}::${variantId || ''}`;

/** Lignes d'une commande → panier local (une entrée par produit + variante, quantités cumulées). */
export function linesToCart(
  lines: { product_id?: string | null; variant_id?: string | null; quantity?: number | null }[],
): Record<string, CartLine> {
  const cart: Record<string, CartLine> = {};
  for (const l of lines) {
    if (!l.product_id) continue;
    const qty = Math.max(0, Math.trunc(Number(l.quantity) || 0));
    if (qty <= 0) continue;
    const variantId = l.variant_id || null;
    const key = cartKey(l.product_id, variantId);
    const prev = cart[key];
    cart[key] = { productId: l.product_id, variantId, quantity: (prev?.quantity || 0) + qty };
  }
  return cart;
}
