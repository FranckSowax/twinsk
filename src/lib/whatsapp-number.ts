// Numéro WhatsApp réel d'un client, avant tout envoi (29 sept. 2026).
//
// Pourquoi : en Côte d'Ivoire, les numéros sont passés de 8 à 10 chiffres le
// 31 janvier 2021 (préfixes 07 Orange, 05 MTN, 01 Moov devant l'ancien numéro).
// Beaucoup de comptes WhatsApp sont restés enregistrés sous l'ANCIEN numéro à
// 8 chiffres. Un message adressé au nouveau format (225 07 xx xx xx xx) ne
// trouve aucun compte : WHAPI l'accepte, WhatsApp le laisse « en attente » pour
// toujours. Cas réel du 29 sept. 2026 : 12 messages de panier jamais remis.
//
// Ordre de résolution :
//   1. conversation où le client a déjà écrit (même indicatif, mêmes 8 derniers chiffres) ;
//   2. WhatsApp lui-même (POST /contacts de WHAPI) : identifiant réel du compte ;
//   3. à défaut, le numéro tel que saisi.
// Résultats gardés 24 h en mémoire (un appel WHAPI par numéro et par jour).

import { supabaseAdmin } from '@/lib/supabase/server';
import { checkWhapiContact } from '@/lib/whapi';
import { matchKnownPhone } from '@/lib/wa-inbox';

const TTL_MS = 24 * 3_600_000;
const cache = new Map<string, { phone: string; at: number }>();

/** Numéro d'une conversation où le client a écrit, s'il correspond au numéro saisi. */
async function phoneFromConversations(d: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('wa_conversations').select('phone, last_inbound_at').ilike('phone', `%${d.slice(-8)}`).limit(10);
  if (error || !data?.length) return null;
  // Une conversation créée par nos seuls envois (numéro mal saisi) ne prouve rien.
  const written = (data as { phone: string; last_inbound_at: string | null }[]).filter((r) => r.last_inbound_at).map((r) => r.phone);
  return matchKnownPhone(d, written);
}

/** Numéro WhatsApp réel (chiffres seuls), ou null si le numéro est inutilisable. */
export async function resolveWhatsappPhone(phone: string | null | undefined): Promise<string | null> {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  const hit = cache.get(d);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.phone;

  let resolved = d;
  const known = await phoneFromConversations(d).catch(() => null);
  if (known) resolved = known;
  else {
    const check = await checkWhapiContact(d);
    if (check.status === 'valid' && check.waId && check.waId !== d) {
      console.log(`[whatsapp] numéro ${d.slice(0, 3)}…${d.slice(-2)} → compte réel ${check.waId.slice(0, 3)}…${check.waId.slice(-2)} (${check.waId.length} chiffres)`);
      resolved = check.waId;
    }
  }
  cache.set(d, { phone: resolved, at: Date.now() });
  return resolved;
}

/** Chat ID WhatsApp d'un client (…@s.whatsapp.net) vers son compte réel, ou null. */
export async function resolveWhatsappChatId(phone: string | null | undefined): Promise<string | null> {
  const p = await resolveWhatsappPhone(phone);
  return p ? `${p}@s.whatsapp.net` : null;
}
