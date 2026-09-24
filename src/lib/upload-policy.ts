// Qui peut envoyer quoi par /api/upload.
//  - Équipe (admin, collaborateur actif, agent actif) : images et vidéos.
//  - Visiteur non connecté (clients : preuve de paiement, photos de demande de
//    sourcing, fret, proposition) : IMAGES SEULEMENT, avec une limite de
//    fréquence par adresse IP. Les vidéos, qui pèsent sur la bande passante
//    Supabase, sont réservées à l'équipe.
// La limite est large (60 fichiers / 10 min / IP) : au Gabon et en Côte
// d'Ivoire, beaucoup d'abonnés mobiles partagent la même adresse IP.

export const ANON_MAX_FILES = 60;
export const ANON_WINDOW_MS = 10 * 60 * 1000;

export type UploadCheck = { ok: true } | { ok: false; status: number; error: string };

/** Règle par fichier (pure). */
export function checkUploadFile(isStaff: boolean, mimeType: string): UploadCheck {
  if (!isStaff && mimeType.startsWith('video/')) {
    return { ok: false, status: 403, error: 'Envoi de vidéos réservé à l’équipe (connectez-vous à l’admin).' };
  }
  return { ok: true };
}

/** Limiteur à fenêtre glissante, en mémoire (une instance par serveur). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max = ANON_MAX_FILES, private windowMs = ANON_WINDOW_MS) {}

  /** Réserve `count` envois pour `key` ; faux si la limite serait dépassée (rien n'est alors compté). */
  take(key: string, count: number, now = Date.now()): boolean {
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (recent.length + count > this.max) {
      this.hits.set(key, recent);
      return false;
    }
    for (let i = 0; i < count; i++) recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}

/** Adresse du client derrière le proxy Railway. */
export function clientIp(headers: Headers): string {
  return (headers.get('x-forwarded-for') || '').split(',')[0].trim() || headers.get('x-real-ip') || 'inconnue';
}
