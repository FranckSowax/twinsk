// Intégration WHAPI (whapi.cloud) — diffusion de messages WhatsApp (groupes/canaux).
// Modèle : src/lib/telegram.ts. Secret via variable d'environnement (WHAPI_TOKEN).
// Endpoint : POST https://gate.whapi.cloud/messages/text  (Bearer token).

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_BASE = process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud';
// Groupe WhatsApp de diffusion Twinsk par défaut (JID). Surchargeable via env.
export const DEFAULT_GROUP_ID = process.env.WHAPI_GROUP_ID || '120363408414253084@g.us';

export interface WhapiResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/** Envoie un message texte WhatsApp (le lien génère un aperçu automatiquement). */
export async function sendWhapiText(
  body: string,
  to: string = DEFAULT_GROUP_ID,
): Promise<WhapiResult> {
  if (!WHAPI_TOKEN) {
    console.warn('[Whapi] WHAPI_TOKEN manquant — envoi ignoré');
    return { ok: false, error: 'WHAPI_TOKEN non configuré (variable d’environnement)' };
  }
  try {
    const res = await fetch(`${WHAPI_BASE}/messages/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHAPI_TOKEN}`,
      },
      body: JSON.stringify({ to, body, typing_time: 0 }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sent?: boolean;
      message?: { id?: string };
      error?: unknown;
    };
    if (!res.ok || data.sent === false) {
      const err = typeof data.error === 'string' ? data.error : JSON.stringify(data.error ?? {});
      console.error(`[Whapi] envoi échoué: ${res.status} ${err}`);
      return { ok: false, error: `Whapi ${res.status}: ${err.slice(0, 200)}` };
    }
    console.log('[Whapi] Message envoyé');
    return { ok: true, messageId: data.message?.id };
  } catch (err) {
    console.error('[Whapi] Erreur:', err);
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

/** Compose le message de diffusion d'une offre (formatage WhatsApp *gras* / _italique_). */
export function buildOfferBroadcast(args: {
  title: string;
  theme?: string | null;
  note?: string | null;
  url: string;
}): string {
  return [
    `🛍️ *${args.title}*`,
    args.theme ? `_${args.theme}_` : null,
    args.note ? `\n${args.note}` : null,
    ``,
    `👉 ${args.url}`,
    ``,
    `Commandez directement via le lien 👆`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

/** Diffuse le lien public d'une offre dans le groupe WhatsApp Twinsk. */
export async function broadcastOfferLink(
  args: { title: string; theme?: string | null; note?: string | null; url: string },
  to?: string,
): Promise<WhapiResult> {
  return sendWhapiText(buildOfferBroadcast(args), to);
}
