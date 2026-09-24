import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildInvoicePayload, normalizeStatus, paydunyaBaseUrl, paydunyaChannels, paydunyaConfig,
  parseBracketForm, readInvoiceData, verifyIpnHash,
} from './paydunya';

describe('configuration', () => {
  it('exige les trois clés, mode test par défaut', () => {
    expect(paydunyaConfig({})).toBeNull();
    expect(paydunyaConfig({ PAYDUNYA_MASTER_KEY: 'm', PAYDUNYA_PRIVATE_KEY: 'p' })).toBeNull();
    expect(paydunyaConfig({ PAYDUNYA_MASTER_KEY: 'm', PAYDUNYA_PRIVATE_KEY: 'p', PAYDUNYA_TOKEN: 't' })?.mode).toBe('test');
    expect(paydunyaConfig({ PAYDUNYA_MASTER_KEY: 'm', PAYDUNYA_PRIVATE_KEY: 'p', PAYDUNYA_TOKEN: 't', PAYDUNYA_MODE: 'live' })?.mode).toBe('live');
  });
  it('adresses documentées', () => {
    expect(paydunyaBaseUrl('test')).toBe('https://app.paydunya.com/sandbox-api/v1');
    expect(paydunyaBaseUrl('live')).toBe('https://app.paydunya.com/api/v1');
  });
  it('opérateurs ivoiriens', () => {
    expect(paydunyaChannels('CI', ['orange_money', 'mtn_momo', 'wave', 'moov_money'])).toEqual(['orange-money-ci', 'mtn-ci', 'wave-ci', 'moov-ci']);
    expect(paydunyaChannels('GA', ['airtel_money'])).toEqual([]);
  });
});

describe('buildInvoicePayload', () => {
  it('montant entier, canaux, actions et données personnalisées', () => {
    const p = buildInvoicePayload({
      amount: 125000.4, description: 'Commande #A1', storeName: 'Oh My Cot', websiteUrl: 'https://x.test',
      customer: { name: ' Awa ', phone: '2250707070707' }, channels: ['wave-ci'],
      returnUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c', callbackUrl: 'https://x.test/ipn',
      customData: { order_id: 'o1' },
    });
    expect(p).toEqual({
      invoice: { total_amount: 125000, description: 'Commande #A1', customer: { name: 'Awa', phone: '2250707070707' }, channels: ['wave-ci'] },
      store: { name: 'Oh My Cot', website_url: 'https://x.test' },
      custom_data: { order_id: 'o1' },
      actions: { cancel_url: 'https://x.test/c', return_url: 'https://x.test/r', callback_url: 'https://x.test/ipn' },
    });
  });
});

describe('IPN', () => {
  const master = 'wQzk9ZwR-Qq9m-0hD0-zpud-je5coGC3FHKW'; // clé d'exemple de la documentation
  const hash = createHash('sha512').update(master).digest('hex');

  it('signature = SHA-512 de la MasterKey', () => {
    expect(verifyIpnHash(hash, master)).toBe(true);
    expect(verifyIpnHash(hash.toUpperCase(), master)).toBe(true);
    expect(verifyIpnHash(hash, 'autre-cle')).toBe(false);
    expect(verifyIpnHash('', master)).toBe(false);
    expect(verifyIpnHash(null, master)).toBe(false);
  });

  it('décode data[...] et lit le statut', () => {
    const root = parseBracketForm([
      ['data[hash]', hash],
      ['data[status]', 'completed'],
      ['data[invoice][token]', 'test_abc'],
      ['data[invoice][total_amount]', '42300'],
      ['data[custom_data][order_id]', 'o1'],
      ['data[__proto__][polluted]', 'x'],
    ]);
    const d = root.data as Record<string, unknown>;
    expect(d.hash).toBe(hash);
    const inv = readInvoiceData(d);
    expect(inv).toMatchObject({ status: 'completed', token: 'test_abc', totalAmount: 42300, customData: { order_id: 'o1' } });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('statut inconnu → pending', () => {
    expect(normalizeStatus('completed')).toBe('completed');
    expect(normalizeStatus('weird')).toBe('pending');
    expect(normalizeStatus(undefined)).toBe('pending');
  });
});
