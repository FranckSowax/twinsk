import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/whapi', () => ({ sendWhapiText: vi.fn() }));

import { buildStatusMessage, isNotifiableStatus } from './order-status-notify';

const base = { orderId: '7176bcac-e106-4001-b8fc-f591d1d5743e', clientName: 'Ruth Mba', recapUrl: 'https://t/offer/o/order/x' };

describe('messages de statut envoyés au client', () => {
  it('payée : montant, délai selon le transport, lien de suivi', () => {
    const m = buildStatusMessage({ ...base, status: 'paid', total: 1029100, currency: 'XAF', transportMode: 'mixed' });
    expect(m).toContain('Paiement confirmé');
    expect(m).toContain('CMD-7176BCAC');
    expect(m).toContain('Bonjour Ruth Mba');
    expect(m).toMatch(/1.029.100 FCFA/);
    expect(m).toContain('partie avion');
    expect(m).toContain('https://t/offer/o/order/x');
  });
  it('payée en euros : montant au format euros', () => {
    expect(buildStatusMessage({ ...base, status: 'paid', total: 410.5, currency: 'EUR', transportMode: 'sea' })).toMatch(/410,50 €/);
  });
  it('expédiée, arrivée, remise : un message distinct par étape', () => {
    expect(buildStatusMessage({ ...base, status: 'shipped', transportMode: 'air' })).toContain('8 à 14 jours');
    expect(buildStatusMessage({ ...base, status: 'at_agency' })).toContain('disponible à l\'agence');
    const d = buildStatusMessage({ ...base, status: 'delivered', clientName: null });
    expect(d).toContain('Commande remise');
    expect(d.startsWith('🤝')).toBe(true);
    expect(d).toContain('Bonjour, ');
  });
  it('seuls les statuts utiles au client déclenchent un message', () => {
    expect(isNotifiableStatus('paid')).toBe(true);
    expect(isNotifiableStatus('unpaid')).toBe(false);
    expect(isNotifiableStatus(undefined)).toBe(false);
  });
});
