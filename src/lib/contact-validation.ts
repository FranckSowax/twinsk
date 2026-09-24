// Coordonnées minimales d'une commande : nom + numéro WhatsApp. Partagé par la
// création de commande, la saisie des coordonnées et le formulaire client.

// Règles de numéro propres au pays : voir src/lib/phone.ts (Gabon inchangé :
// 8 chiffres locaux au moins ; Côte d'Ivoire : 10 chiffres, indicatif ajouté).
export const MIN_PHONE_DIGITS = COUNTRY.localPhoneDigits;
import { COUNTRY } from '@/config/countries';
import { normalizePhone, validatePhone } from '@/lib/phone';

export function normalizeContactPhone(phone: string | null | undefined): string {
  return normalizePhone(phone);
}

export type ContactCheck = { ok: true; name: string; phone: string } | { ok: false; error: string };

/** Valide et normalise nom + téléphone. Le téléphone conservé est en chiffres seuls. */
export function validateContact(name: string | null | undefined, phone: string | null | undefined): ContactCheck {
  const n = (name || '').trim().replace(/\s+/g, ' ');
  if (n.length < 2) return { ok: false, error: 'Votre nom complet est requis.' };
  if (!/\p{L}/u.test(n)) return { ok: false, error: 'Le nom doit contenir des lettres.' };
  const p = validatePhone(phone);
  if (!p.ok) return p;
  return { ok: true, name: n.slice(0, 80), phone: p.phone };
}
