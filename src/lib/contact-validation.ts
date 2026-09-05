// Coordonnées minimales d'une commande : nom + numéro WhatsApp. Partagé par la
// création de commande, la saisie des coordonnées et le formulaire client.

export const MIN_PHONE_DIGITS = 8; // Gabon : 8 chiffres locaux (07 42 75 60) ; international ≥ 10

export function normalizeContactPhone(phone: string | null | undefined): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  return d;
}

export type ContactCheck = { ok: true; name: string; phone: string } | { ok: false; error: string };

/** Valide et normalise nom + téléphone. Le téléphone conservé est en chiffres seuls. */
export function validateContact(name: string | null | undefined, phone: string | null | undefined): ContactCheck {
  const n = (name || '').trim().replace(/\s+/g, ' ');
  const p = normalizeContactPhone(phone);
  if (n.length < 2) return { ok: false, error: 'Votre nom complet est requis.' };
  if (!/\p{L}/u.test(n)) return { ok: false, error: 'Le nom doit contenir des lettres.' };
  if (p.length < MIN_PHONE_DIGITS) return { ok: false, error: 'Un numéro WhatsApp valide est requis (8 chiffres minimum).' };
  if (p.length > 15) return { ok: false, error: 'Numéro WhatsApp trop long.' };
  if (/^(\d)\1+$/.test(p)) return { ok: false, error: 'Numéro WhatsApp invalide.' };
  return { ok: true, name: n.slice(0, 80), phone: p };
}
