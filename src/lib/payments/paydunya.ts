// Adaptateur PayDunya (agrégateur mobile money, Côte d'Ivoire).
// Écrit uniquement d'après la documentation officielle « HTTP/JSON »
// (developers.paydunya.com/doc/FR/http_json) et la liste des opérateurs
// (developers.paydunya.com/doc/FR/softpay), lues le 24 septembre 2026 :
//   - POST {base}/checkout-invoice/create  → { response_code: "00", response_text: <url de paiement>, token }
//   - GET  {base}/checkout-invoice/confirm/{token} → { status: pending|completed|cancelled|failed, invoice: { total_amount, token }, … }
//   - IPN : POST x-www-form-urlencoded « data[...] » sur actions.callback_url ;
//     data[hash] = SHA-512 de la clé principale (MasterKey).
//   - Montants en FCFA, sans champ devise.
//
// TODO(franck) : compte marchand PayDunya validé, puis dans Railway (service CI) :
//   PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN, PAYDUNYA_MODE (test | live).
// Sans ces variables, le paiement mobile money répond « non configuré » (503).

import { createHash, timingSafeEqual } from 'node:crypto';
import type { CountryCode, PaymentProviderId } from '@/config/countries';

export type PaydunyaStatus = 'pending' | 'completed' | 'cancelled' | 'failed';

export interface PaydunyaConfig {
  masterKey: string;
  privateKey: string;
  token: string;
  mode: 'test' | 'live';
}

export function paydunyaConfig(env: Record<string, string | undefined> = process.env): PaydunyaConfig | null {
  const masterKey = env.PAYDUNYA_MASTER_KEY?.trim();
  const privateKey = env.PAYDUNYA_PRIVATE_KEY?.trim();
  const token = env.PAYDUNYA_TOKEN?.trim();
  if (!masterKey || !privateKey || !token) return null;
  return { masterKey, privateKey, token, mode: env.PAYDUNYA_MODE === 'live' ? 'live' : 'test' };
}

export function paydunyaBaseUrl(mode: PaydunyaConfig['mode']): string {
  return mode === 'live' ? 'https://app.paydunya.com/api/v1' : 'https://app.paydunya.com/sandbox-api/v1';
}

/** Identifiants d'opérateurs PayDunya (clé « channels »), par pays. */
const CHANNELS: Partial<Record<CountryCode, Partial<Record<PaymentProviderId, string>>>> = {
  CI: { orange_money: 'orange-money-ci', mtn_momo: 'mtn-ci', wave: 'wave-ci', moov_money: 'moov-ci' },
};

export function paydunyaChannels(country: CountryCode, operators: readonly PaymentProviderId[]): string[] {
  const map = CHANNELS[country] || {};
  return operators.map((o) => map[o]).filter((c): c is string => !!c);
}

export interface InvoiceInput {
  amount: number;
  description: string;
  storeName: string;
  websiteUrl?: string;
  customer?: { name?: string | null; phone?: string | null };
  channels: string[];
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  customData: Record<string, string>;
}

/** Corps de POST checkout-invoice/create (pur, testé). */
export function buildInvoicePayload(i: InvoiceInput) {
  const customer: Record<string, string> = {};
  if (i.customer?.name?.trim()) customer.name = i.customer.name.trim();
  if (i.customer?.phone?.trim()) customer.phone = i.customer.phone.trim();
  return {
    invoice: {
      total_amount: Math.round(i.amount),
      description: i.description.slice(0, 250),
      ...(Object.keys(customer).length ? { customer } : {}),
      ...(i.channels.length ? { channels: i.channels } : {}),
    },
    store: { name: i.storeName, ...(i.websiteUrl ? { website_url: i.websiteUrl } : {}) },
    custom_data: i.customData,
    actions: { cancel_url: i.cancelUrl, return_url: i.returnUrl, callback_url: i.callbackUrl },
  };
}

function headers(cfg: PaydunyaConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': cfg.masterKey,
    'PAYDUNYA-PRIVATE-KEY': cfg.privateKey,
    'PAYDUNYA-TOKEN': cfg.token,
  };
}

export type CreateInvoiceResult =
  | { ok: true; token: string; checkoutUrl: string }
  | { ok: false; error: string };

export async function createInvoice(cfg: PaydunyaConfig, input: InvoiceInput): Promise<CreateInvoiceResult> {
  try {
    const res = await fetch(`${paydunyaBaseUrl(cfg.mode)}/checkout-invoice/create`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(buildInvoicePayload(input)),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => ({}))) as { response_code?: string; response_text?: string; token?: string };
    if (json.response_code === '00' && json.token && json.response_text) {
      return { ok: true, token: json.token, checkoutUrl: json.response_text };
    }
    return { ok: false, error: json.response_text || `PayDunya HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'PayDunya injoignable' };
  }
}

export interface ConfirmedInvoice {
  status: PaydunyaStatus;
  token: string;
  totalAmount: number;
  customData: Record<string, unknown>;
  receiptUrl: string | null;
  raw: unknown;
}

export function normalizeStatus(v: unknown): PaydunyaStatus {
  return v === 'completed' || v === 'cancelled' || v === 'failed' ? v : 'pending';
}

/** Lecture d'une réponse « confirm » ou d'un IPN décodé (même structure). */
export function readInvoiceData(d: Record<string, unknown>, fallbackToken = ''): ConfirmedInvoice {
  const invoice = (d.invoice && typeof d.invoice === 'object' ? d.invoice : {}) as Record<string, unknown>;
  return {
    status: normalizeStatus(d.status),
    token: String(invoice.token || fallbackToken),
    totalAmount: Number(invoice.total_amount) || 0,
    customData: (d.custom_data && typeof d.custom_data === 'object' ? d.custom_data : {}) as Record<string, unknown>,
    receiptUrl: typeof d.receipt_url === 'string' ? d.receipt_url : null,
    raw: d,
  };
}

/** Statut faisant foi, demandé à PayDunya (utilisé aussi pour recouper un IPN). */
export async function confirmInvoice(cfg: PaydunyaConfig, token: string): Promise<ConfirmedInvoice | null> {
  try {
    const res = await fetch(`${paydunyaBaseUrl(cfg.mode)}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
      headers: headers(cfg),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json || json.response_code !== '00') return null;
    return readInvoiceData(json, token);
  } catch {
    return null;
  }
}

/** data[hash] de l'IPN = SHA-512 (hex) de la MasterKey. Comparaison à temps constant. */
export function verifyIpnHash(hash: string | null | undefined, masterKey: string): boolean {
  if (!hash || !masterKey) return false;
  const expected = Buffer.from(createHash('sha512').update(masterKey).digest('hex'), 'utf8');
  const got = Buffer.from(hash.trim().toLowerCase(), 'utf8');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Décode les clés « data[invoice][token] » d'un formulaire en objet imbriqué.
 * Retourne l'objet racine (on lit ensuite `.data`).
 */
export function parseBracketForm(entries: Iterable<[string, string]>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const parts = key.replace(/\]/g, '').split('[').filter((p) => p !== '');
    if (!parts.length || parts.some((p) => p === '__proto__' || p === 'constructor' || p === 'prototype')) continue;
    let node = root;
    parts.forEach((p, idx) => {
      if (idx === parts.length - 1) node[p] = value;
      else {
        if (!node[p] || typeof node[p] !== 'object') node[p] = {};
        node = node[p] as Record<string, unknown>;
      }
    });
  }
  return root;
}
