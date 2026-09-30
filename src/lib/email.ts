// Envoi d'e-mails par la plateforme via Resend (API HTTP, sans SDK).
// Expéditeur : COUNTRY.outboundEmail (domaine vérifié chez Resend), surchargé
// par EMAIL_FROM_ADDRESS / EMAIL_FROM_NAME ; clé : RESEND_API_KEY (Railway).
// Les réponses arrivent dans la boîte de l'expéditeur (Reply-To), pas ici.

import { COUNTRY } from '@/config/countries';

export interface EmailSender {
  address: string;
  name: string;
}
export interface EmailInput {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  replyTo?: string;
  /** Étiquettes Resend (suivi) : lettres, chiffres, _ et - seulement. */
  tags?: Record<string, string>;
  /** Évite un double envoi si la requête est rejouée (24 h chez Resend). */
  idempotencyKey?: string;
}
export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;

export function emailSender(): EmailSender | null {
  const address = process.env.EMAIL_FROM_ADDRESS?.trim() || COUNTRY.outboundEmail?.address || '';
  if (!EMAIL_RE.test(address)) return null;
  return { address, name: process.env.EMAIL_FROM_NAME?.trim() || COUNTRY.outboundEmail?.name || COUNTRY.senderName };
}
export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim() && !!emailSender();
}

/** « a@x.com ; B@y.cn, c@z.fr » → adresses valides, sans doublon (casse ignorée). */
export function parseRecipients(v: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(v) ? v.join(',') : v || '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const a = part.replace(/^<|>$/g, '').trim();
    if (EMAIL_RE.test(a) && !seen.has(a.toLowerCase())) {
      seen.add(a.toLowerCase());
      out.push(a);
    }
  }
  return out;
}
/** « Twinsk Sourcing <sourcing@…> » (guillemets retirés du nom). */
export function formatFrom(s: EmailSender): string {
  return `${s.name.replace(/["<>]/g, '').trim()} <${s.address}>`;
}
const tagValue = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const sender = emailSender();
  if (!key) return { ok: false, error: 'RESEND_API_KEY absente : envoi d’e-mails non configuré' };
  if (!sender) return { ok: false, error: 'Aucune adresse d’expédition configurée pour ce pays' };
  const to = parseRecipients(input.to);
  if (!to.length) return { ok: false, error: 'Aucun destinataire valide' };
  if (!input.subject.trim() || !input.text.trim()) return { ok: false, error: 'Objet et message requis' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey.slice(0, 256) } : {}) },
      body: JSON.stringify({
        from: formatFrom(sender),
        to,
        ...(input.cc?.length ? { cc: parseRecipients(input.cc) } : {}),
        subject: input.subject.trim().slice(0, 300),
        text: input.text,
        reply_to: input.replyTo || sender.address,
        ...(input.tags ? { tags: Object.entries(input.tags).map(([name, value]) => ({ name: tagValue(name), value: tagValue(value) })) } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const d = (await r.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!r.ok || !d.id) return { ok: false, error: `Resend ${r.status} : ${d.message || d.name || 'envoi refusé'}` };
    return { ok: true, id: d.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Envoi impossible' };
  }
}
