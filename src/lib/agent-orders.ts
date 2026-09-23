// Espace agents Gabon : quelles commandes l'agent voit. Seules les commandes
// payées ou dont le paiement est engagé (espèces réservées à l'agence, preuve
// Airtel Money déposée) : les paniers ouverts, jamais payés, restent hors de
// sa vue — depuis que l'ajout au panier crée la commande, ils sont nombreux.

/** Statuts de paiement visibles par un agent : `submitted` = à encaisser / à valider. */
export const AGENT_VISIBLE_PAYMENT = ['paid', 'submitted'] as const;

export function isAgentVisible(paymentStatus: string | null | undefined): boolean {
  return (AGENT_VISIBLE_PAYMENT as readonly string[]).includes(paymentStatus || '');
}
