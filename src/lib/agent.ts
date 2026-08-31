// Auth agents Gabon : cookie HMAC stateless relu en base, OTP WhatsApp hashé.
// Réutilise les patterns de collab.ts (crypto natif, timingSafeEqual).
import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase/server';

const SECRET = process.env.ADMIN_PASSWORD || 'twinsk-dev-secret';

export const AGENT_COOKIE = 'agent_token';
export const SESSION_MAX_AGE = 2592000; // 30 jours (secondes)
export const OTP_TTL_MS = 600000; // 10 minutes

export function normalizePhone(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '');
}

export function signAgentToken(id: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(id).digest('base64url');
  return `${id}.${sig}`;
}

export function parseAgentToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const id = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(id).digest('base64url');
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return id;
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(code: string): string {
  return crypto.createHmac('sha256', SECRET).update(code).digest('hex');
}

export function verifyOtpHash(code: string, hash: string): boolean {
  const test = hashOtp(code);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function otpRateLimited(recentCount: number): boolean {
  return recentCount >= 10; // allégé : 10 OTP / 10 min par agent (silencieux au-delà)
}

/**
 * Candidats de correspondance pour un numéro saisi : tolère l'absence (ou la
 * présence) du préfixe pays 241 — « 06871309 » matche « 24106871309 » et
 * inversement. Évite les échecs silencieux de l'OTP sur un simple format.
 */
export function phoneCandidates(phone: string | null | undefined): string[] {
  const d = normalizePhone(phone);
  if (!d) return [];
  const out = new Set<string>([d]);
  if (d.startsWith('241')) out.add(d.slice(3));
  else out.add(`241${d}`);
  return [...out].filter((x) => x.length >= 6);
}

export type AgentOrderStatus = 'unpaid' | 'paid' | 'shipped' | 'at_agency' | 'delivered';
const ORDER: AgentOrderStatus[] = ['unpaid', 'paid', 'shipped', 'at_agency', 'delivered'];

export function canAdvanceTo(from: AgentOrderStatus, to: AgentOrderStatus): boolean {
  const fi = ORDER.indexOf(from);
  const ti = ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return ti === fi || ti === fi + 1;
}

export async function getAgent(
  request: NextRequest,
): Promise<{ id: string; name: string } | null> {
  const id = parseAgentToken(request.cookies.get(AGENT_COOKIE)?.value);
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from('agents')
    .select('id, name, active')
    .eq('id', id)
    .single();
  if (!data || !data.active) return null;
  return { id: data.id, name: data.name };
}
