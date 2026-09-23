import { describe, expect, it } from 'vitest';
import { isAgentVisible } from './agent-orders';

describe('isAgentVisible — l’agent ne voit que les commandes payées ou au paiement engagé', () => {
  it('payée, espèces réservées ou preuve Airtel déposée : visible', () => {
    expect(isAgentVisible('paid')).toBe(true);
    expect(isAgentVisible('submitted')).toBe(true);
  });
  it('panier ouvert jamais payé, statut absent : masqué', () => {
    expect(isAgentVisible('pending')).toBe(false);
    expect(isAgentVisible(null)).toBe(false);
    expect(isAgentVisible(undefined)).toBe(false);
  });
});
