// Intégration WHAPI (whapi.cloud) — diffusion de messages WhatsApp (groupes/canaux).
// Modèle : src/lib/telegram.ts. Secret via variable d'environnement (WHAPI_TOKEN).
// Endpoints : POST /messages/text · /messages/image · /messages/interactive (Bearer token).

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_BASE = process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud';
// Groupe WhatsApp de diffusion Twinsk par défaut (JID). Surchargeable via env.
export const DEFAULT_GROUP_ID = process.env.WHAPI_GROUP_ID || '120363408414253084@g.us';

export interface WhapiResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/** Appel bas-niveau à un endpoint WHAPI (gère token + erreurs). */
async function whapiPost(path: string, payload: Record<string, unknown>): Promise<WhapiResult> {
  if (!WHAPI_TOKEN) {
    console.warn('[Whapi] WHAPI_TOKEN manquant — envoi ignoré');
    return { ok: false, error: 'WHAPI_TOKEN non configuré (variable d’environnement)' };
  }
  try {
    const res = await fetch(`${WHAPI_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHAPI_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sent?: boolean;
      message?: { id?: string };
      error?: unknown;
    };
    if (!res.ok || data.sent === false) {
      const err = typeof data.error === 'string' ? data.error : JSON.stringify(data.error ?? {});
      console.error(`[Whapi] ${path} échoué: ${res.status} ${err}`);
      return { ok: false, error: `Whapi ${res.status}: ${err.slice(0, 200)}` };
    }
    return { ok: true, messageId: data.message?.id };
  } catch (err) {
    console.error('[Whapi] Erreur:', err);
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

/** Appel GET bas-niveau à un endpoint WHAPI. */
async function whapiGet<T = unknown>(path: string): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (!WHAPI_TOKEN) {
    return { ok: false, error: 'WHAPI_TOKEN non configuré (variable d’environnement)' };
  }
  try {
    const res = await fetch(`${WHAPI_BASE}${path}`, {
      headers: { Authorization: `Bearer ${WHAPI_TOKEN}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `Whapi ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

/** Envoie un message texte (le lien génère un aperçu automatiquement). */
export async function sendWhapiText(body: string, to: string = DEFAULT_GROUP_ID): Promise<WhapiResult> {
  return whapiPost('/messages/text', { to, body, typing_time: 0 });
}

// ----------------------------------------------------------------------------
// Gestion de groupe
// ----------------------------------------------------------------------------

export interface WhapiGroupSummary {
  id: string;
  name: string;
  participantsCount: number;
}

export interface WhapiGroupInfo extends WhapiGroupSummary {
  adminsCount: number;
  inviteLink: string | null;
}

interface RawParticipant { id?: string; rank?: string }
interface RawGroup { id?: string; name?: string; subject?: string; size?: number; participants?: RawParticipant[] }

const ADMIN_RANKS = new Set(['admin', 'superadmin', 'creator', 'owner']);

/** Liste les groupes du numéro connecté (pour retrouver un group id). */
export async function listWhapiGroups(): Promise<{ ok: boolean; groups?: WhapiGroupSummary[]; error?: string }> {
  const r = await whapiGet<{ groups?: RawGroup[] }>('/groups?count=100');
  if (!r.ok) return { ok: false, error: r.error };
  const raw = Array.isArray(r.data?.groups) ? r.data!.groups! : [];
  return {
    ok: true,
    groups: raw.map((g) => ({
      id: g.id || '',
      name: g.name || g.subject || '(sans nom)',
      participantsCount: g.size ?? (Array.isArray(g.participants) ? g.participants.length : 0),
    })),
  };
}

/** Récupère le lien d'invitation d'un groupe (best-effort). */
export async function getGroupInviteLink(id: string = DEFAULT_GROUP_ID): Promise<string | null> {
  const r = await whapiGet<{ invite_link?: string; invite_code?: string } | string>(
    `/groups/${encodeURIComponent(id)}/invite`,
  );
  if (!r.ok || !r.data) return null;
  const d = r.data as { invite_link?: string; invite_code?: string } | string;
  if (typeof d === 'string') return d.startsWith('http') ? d : `https://chat.whatsapp.com/${d}`;
  if (d.invite_link) return d.invite_link;
  if (d.invite_code) return `https://chat.whatsapp.com/${d.invite_code}`;
  return null;
}

/** Infos d'un groupe : nom, nb participants, nb admins, lien d'invitation. */
export async function getGroupInfo(
  id: string = DEFAULT_GROUP_ID,
): Promise<{ ok: boolean; group?: WhapiGroupInfo; error?: string }> {
  const r = await whapiGet<RawGroup>(`/groups/${encodeURIComponent(id)}`);
  if (!r.ok) return { ok: false, error: r.error };
  const d = r.data || {};
  const participants = Array.isArray(d.participants) ? d.participants : [];
  const adminsCount = participants.filter((p) => p.rank && ADMIN_RANKS.has(p.rank)).length;
  const inviteLink = await getGroupInviteLink(id);
  return {
    ok: true,
    group: {
      id: d.id || id,
      name: d.name || d.subject || '(sans nom)',
      participantsCount: d.size ?? participants.length,
      adminsCount,
      inviteLink,
    },
  };
}

/** Ajoute des participants à un groupe (numéros au format international, sans +). */
export async function addGroupParticipants(
  phones: string[],
  id: string = DEFAULT_GROUP_ID,
): Promise<WhapiResult> {
  const clean = phones.map((p) => p.replace(/[^\d]/g, '')).filter((p) => p.length >= 8);
  if (!clean.length) return { ok: false, error: 'Aucun numéro valide (format international sans +)' };
  return whapiPost(`/groups/${encodeURIComponent(id)}/participants`, { participants: clean });
}

/** Envoie une image (media = URL publique) avec légende optionnelle. */
export async function sendWhapiImage(
  mediaUrl: string,
  caption: string | undefined,
  to: string = DEFAULT_GROUP_ID,
): Promise<WhapiResult> {
  // WHAPI accepte `media` sous forme d'URL publique (ou base64 / media id).
  return whapiPost('/messages/image', { to, media: mediaUrl, caption });
}

/** Envoie un message interactif avec un bouton URL (boutons WHAPI = « as-is », instables). */
export async function sendWhapiButtonLink(args: {
  body: string;
  buttonTitle: string;
  url: string;
  to?: string;
}): Promise<WhapiResult> {
  return whapiPost('/messages/interactive', {
    to: args.to ?? DEFAULT_GROUP_ID,
    type: 'button',
    body: { text: args.body },
    action: {
      buttons: [{ type: 'url', title: args.buttonTitle.slice(0, 20), id: 'offer_link', url: args.url }],
    },
  });
}

/** Corps du message d'une offre : titre (*gras*) + thème (_italique_) + description. */
export function buildOfferBody(args: {
  title: string;
  theme?: string | null;
  description?: string | null;
}): string {
  return [
    `🛍️ *${args.title}*`,
    args.theme ? `_${args.theme}_` : null,
    args.description ? `\n${args.description}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

export interface BroadcastResult {
  ok: boolean;
  error?: string;
  steps: { image?: WhapiResult; message: WhapiResult };
  /** true si le message final est passé par le fallback texte (bouton échoué). */
  buttonFallback?: boolean;
}

/**
 * Diffuse une offre dans le groupe : image (cover/upload) PUIS message + bouton URL.
 * Si le bouton échoue (instabilité WHAPI), repli sur un message texte avec le lien.
 */
export async function broadcastOfferRich(args: {
  title: string;
  theme?: string | null;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  to?: string;
}): Promise<BroadcastResult> {
  const to = args.to ?? DEFAULT_GROUP_ID;
  const body = buildOfferBody(args);

  // 1) Image d'abord (best-effort).
  let image: WhapiResult | undefined;
  if (args.imageUrl) {
    image = await sendWhapiImage(args.imageUrl, undefined, to);
  }

  // 2) Message avec bouton URL, fallback texte + lien si échec.
  let buttonFallback = false;
  let message = await sendWhapiButtonLink({ body, buttonTitle: 'Voir l’offre', url: args.url, to });
  if (!message.ok) {
    buttonFallback = true;
    message = await sendWhapiText(`${body}\n\n👉 ${args.url}`, to);
  }

  const ok = message.ok && (args.imageUrl ? !!image?.ok : true);
  const error = !message.ok
    ? message.error
    : args.imageUrl && !image?.ok
      ? `Image non envoyée : ${image?.error}`
      : undefined;

  return { ok, error, steps: { image, message }, buttonFallback };
}
