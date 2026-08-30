// Intégration WHAPI (whapi.cloud) — diffusion de messages WhatsApp (groupes/canaux).
// Modèle : src/lib/telegram.ts. Secret via variable d'environnement (WHAPI_TOKEN).
// Endpoints : POST /messages/text · /messages/image · /messages/interactive (Bearer token).

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_BASE = process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud';
// Groupe WhatsApp de diffusion Twinsk par défaut (JID). Surchargeable via env.
export const DEFAULT_GROUP_ID = process.env.WHAPI_GROUP_ID || '120363408414253084@g.us';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Règles de conformité anti-blocage (ajout de participants) ---
// L'ajout massif direct = risque anti-spam Meta. On ajoute par petits lots espacés,
// avec un plafond par appel. Au-delà : privilégier le lien d'invitation (voie sûre).
const ADD_BATCH_SIZE = 5; // participants par lot
const ADD_BATCH_DELAY_MS = 3000; // pause entre lots
export const MAX_ADD_PER_CALL = 20; // plafond dur par requête

export interface WhapiResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/** Appel bas-niveau à un endpoint WHAPI (gère token + erreurs). */
async function whapiRequest(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  payload: Record<string, unknown>,
): Promise<WhapiResult> {
  if (!WHAPI_TOKEN) {
    console.warn('[Whapi] WHAPI_TOKEN manquant — envoi ignoré');
    return { ok: false, error: 'WHAPI_TOKEN non configuré (variable d’environnement)' };
  }
  try {
    const res = await fetch(`${WHAPI_BASE}${path}`, {
      method,
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

/** Raccourci POST. */
function whapiPost(path: string, payload: Record<string, unknown>): Promise<WhapiResult> {
  return whapiRequest('POST', path, payload);
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

/** Envoie un sondage (poll) — l'option interactive STABLE de WhatsApp (vs boutons). */
export async function sendWhapiPoll(args: {
  title: string;
  options: string[];
  multiple?: boolean;
  to?: string;
}): Promise<WhapiResult> {
  const title = args.title.trim();
  const opts = args.options.map((o) => o.trim()).filter(Boolean).slice(0, 12);
  if (!title) return { ok: false, error: 'Titre du sondage requis' };
  if (opts.length < 2) return { ok: false, error: 'Au moins 2 options requises' };
  return whapiPost('/messages/poll', {
    to: args.to ?? DEFAULT_GROUP_ID,
    title,
    options: opts,
    count: args.multiple ? 0 : 1, // 1 = choix unique · 0 = choix multiples
  });
}

/** Diffuse une annonce libre : image (avec le texte en légende) OU texte seul. */
export async function broadcastAnnouncement(
  message: string,
  imageUrl?: string | null,
  to: string = DEFAULT_GROUP_ID,
): Promise<WhapiResult> {
  const text = message.trim();
  if (imageUrl) return sendWhapiImage(imageUrl, text || undefined, to);
  if (!text) return { ok: false, error: 'Message ou image requis' };
  return sendWhapiText(text, to);
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
interface RawGroup { id?: string; name?: string; subject?: string; size?: number; participants_count?: number; participants?: RawParticipant[] }

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

export interface AddParticipantsResult {
  ok: boolean;
  error?: string;
  requested: number; // numéros fournis (valides, dédupliqués)
  attempted: number; // numéros réellement soumis à WHAPI
  skipped: number; // au-delà du plafond MAX_ADD_PER_CALL
  batches: number;
}

/**
 * Ajoute des participants à un groupe, en CONFORMITÉ anti-blocage Meta :
 *  - numéros dédupliqués et convertis en Chat ID `<numéro>@s.whatsapp.net`
 *  - envoi par petits lots (ADD_BATCH_SIZE) espacés (ADD_BATCH_DELAY_MS)
 *  - plafond dur par appel (MAX_ADD_PER_CALL) ; au-delà, le surplus est ignoré
 *    (l'appelant doit privilégier le lien d'invitation pour les grandes listes).
 * Rappel : WhatsApp peut refuser silencieusement certains contacts (privacy/blocage).
 */
export async function addGroupParticipants(
  phones: string[],
  id: string = DEFAULT_GROUP_ID,
): Promise<AddParticipantsResult> {
  const clean = Array.from(
    new Set(phones.map((p) => p.replace(/[^\d]/g, '')).filter((p) => p.length >= 8)),
  );
  if (!clean.length) {
    return { ok: false, error: 'Aucun numéro valide (format international sans +)', requested: 0, attempted: 0, skipped: 0, batches: 0 };
  }
  const capped = clean.slice(0, MAX_ADD_PER_CALL);
  const skipped = clean.length - capped.length;

  let attempted = 0;
  let batches = 0;
  let lastError: string | undefined;

  for (let i = 0; i < capped.length; i += ADD_BATCH_SIZE) {
    const batch = capped.slice(i, i + ADD_BATCH_SIZE).map((n) => `${n}@s.whatsapp.net`);
    const res = await whapiPost(`/groups/${encodeURIComponent(id)}/participants`, {
      participants: batch,
    });
    batches += 1;
    if (res.ok) attempted += batch.length;
    else lastError = res.error;
    if (i + ADD_BATCH_SIZE < capped.length) await sleep(ADD_BATCH_DELAY_MS);
  }

  return {
    ok: attempted > 0,
    error: attempted > 0 ? undefined : lastError,
    requested: clean.length,
    attempted,
    skipped,
    batches,
  };
}

// ----------------------------------------------------------------------------
// Communautés (Oh My Group) — endpoints /communities de WHAPI
// ----------------------------------------------------------------------------

export interface WhapiCommunity {
  id: string;
  name: string;
  participantsCount: number;
}

/** Liste les communautés du numéro connecté (GET /communities). */
export async function listWhapiCommunities(): Promise<{ ok: boolean; communities?: WhapiCommunity[]; error?: string }> {
  // La réponse réelle utilise la clé `communities` (la doc historique disait `groups`) —
  // on accepte les deux formes.
  const r = await whapiGet<{ communities?: RawGroup[]; groups?: RawGroup[] }>('/communities?count=50');
  if (!r.ok) return { ok: false, error: r.error };
  const raw = Array.isArray(r.data?.communities)
    ? r.data!.communities!
    : Array.isArray(r.data?.groups)
      ? r.data!.groups!
      : [];
  return {
    ok: true,
    communities: raw.map((g) => ({
      id: g.id || '',
      name: g.name || g.subject || '(sans nom)',
      participantsCount:
        g.participants_count ?? g.size ?? (Array.isArray(g.participants) ? g.participants.length : 0),
    })),
  };
}

export interface CommunitySubgroup {
  id: string;
  title: string;
  inviteCode: string | null;
}

/**
 * Sous-groupes d'une communauté (GET /communities/{id}/subgroups).
 * `announce` = le groupe Annonces (seul canal qui touche TOUS les membres).
 */
export async function getCommunitySubgroups(
  communityId: string,
): Promise<{ ok: boolean; announce?: CommunitySubgroup | null; groups?: CommunitySubgroup[]; error?: string }> {
  interface RawSub { id?: string; title?: string; inviteCode?: string; invite_code?: string }
  const r = await whapiGet<{ announceGroupInfo?: RawSub; otherGroups?: RawSub[] }>(
    `/communities/${encodeURIComponent(communityId)}/subgroups`,
  );
  if (!r.ok) return { ok: false, error: r.error };
  const toSub = (s: RawSub | undefined | null): CommunitySubgroup | null =>
    s && s.id ? { id: s.id, title: s.title || '(sans nom)', inviteCode: s.inviteCode || s.invite_code || null } : null;
  return {
    ok: true,
    announce: toSub(r.data?.announceGroupInfo),
    groups: (r.data?.otherGroups || []).map((s) => toSub(s)).filter((s): s is CommunitySubgroup => !!s),
  };
}

/**
 * Crée un sous-groupe DANS la communauté (POST /communities/{id}).
 * WhatsApp exige au moins 1 participant (format international sans +).
 */
export async function createGroupInCommunity(
  communityId: string,
  subject: string,
  phones: string[],
): Promise<{ ok: boolean; groupId?: string; error?: string }> {
  if (!WHAPI_TOKEN) return { ok: false, error: 'WHAPI_TOKEN non configuré (variable d’environnement)' };
  const participants = Array.from(
    new Set(phones.map((p) => p.replace(/[^\d]/g, '')).filter((p) => p.length >= 8)),
  ).map((n) => `${n}@s.whatsapp.net`);
  if (!participants.length) {
    return { ok: false, error: 'Au moins un numéro (format international) est requis pour créer un groupe' };
  }
  try {
    const res = await fetch(`${WHAPI_BASE}/communities/${encodeURIComponent(communityId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WHAPI_TOKEN}` },
      body: JSON.stringify({ subject: subject.trim(), participants: participants.slice(0, ADD_BATCH_SIZE) }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; group_id?: string; error?: unknown };
    if (!res.ok) {
      return { ok: false, error: `Whapi ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 200)}` };
    }
    const groupId = data.id || data.group_id;
    if (!groupId) return { ok: false, error: 'Sous-groupe créé mais id introuvable dans la réponse' };
    if (participants.length > ADD_BATCH_SIZE) {
      await addGroupParticipants(phones.slice(ADD_BATCH_SIZE), groupId);
    }
    return { ok: true, groupId };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

/**
 * Crée un groupe WhatsApp (POST /groups). WhatsApp exige au moins 1 participant
 * en plus du numéro connecté (format <numéro>@s.whatsapp.net).
 * Retourne l'id du groupe créé (…@g.us).
 */
export async function createWhapiGroup(
  subject: string,
  phones: string[],
): Promise<{ ok: boolean; groupId?: string; error?: string }> {
  if (!WHAPI_TOKEN) return { ok: false, error: 'WHAPI_TOKEN non configuré (variable d’environnement)' };
  const participants = Array.from(
    new Set(phones.map((p) => p.replace(/[^\d]/g, '')).filter((p) => p.length >= 8)),
  ).map((n) => `${n}@s.whatsapp.net`);
  if (!participants.length) {
    return { ok: false, error: 'Au moins un numéro (format international) est requis pour créer un groupe' };
  }
  try {
    const res = await fetch(`${WHAPI_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WHAPI_TOKEN}` },
      body: JSON.stringify({ subject: subject.trim(), participants: participants.slice(0, ADD_BATCH_SIZE) }),
    });
    const data = (await res.json().catch(() => ({}))) as { group_id?: string; id?: string; error?: unknown };
    if (!res.ok) {
      return { ok: false, error: `Whapi ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 200)}` };
    }
    const groupId = data.group_id || data.id;
    if (!groupId) return { ok: false, error: 'Groupe créé mais id introuvable dans la réponse' };
    // Le reste des participants est ajouté par lots conformes anti-spam.
    if (participants.length > ADD_BATCH_SIZE) {
      await addGroupParticipants(phones.slice(ADD_BATCH_SIZE), groupId);
    }
    return { ok: true, groupId };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

// ----------------------------------------------------------------------------
// Administration de groupe (nom, description, permissions, admins, épingles)
// ----------------------------------------------------------------------------

/** Met à jour nom et/ou description d'un groupe (PUT /groups/{id}). */
export async function updateWhapiGroupInfo(
  id: string,
  info: { subject?: string; description?: string },
): Promise<WhapiResult> {
  const payload: Record<string, unknown> = {};
  if (info.subject?.trim()) payload.subject = info.subject.trim();
  if (info.description !== undefined) payload.description = info.description;
  if (!Object.keys(payload).length) return { ok: false, error: 'Rien à mettre à jour' };
  return whapiRequest('PUT', `/groups/${encodeURIComponent(id)}`, payload);
}

export type GroupSettingKey =
  | 'send_messages'
  | 'edit_group_info'
  | 'approve_participants'
  | 'add_participants';
export type GroupSettingPolicy = 'anyone' | 'admins';

/** Règle une permission de groupe (PATCH /groups/{id} {setting, policy}). */
export async function setWhapiGroupSetting(
  id: string,
  setting: GroupSettingKey,
  policy: GroupSettingPolicy,
): Promise<WhapiResult> {
  return whapiRequest('PATCH', `/groups/${encodeURIComponent(id)}`, { setting, policy });
}

/** Promeut des numéros comme admins du groupe (PATCH /groups/{id}/admins). */
export async function promoteWhapiGroupAdmins(
  id: string,
  phones: string[],
): Promise<WhapiResult> {
  const participants = Array.from(
    new Set(phones.map((p) => p.replace(/[^\d]/g, '')).filter((p) => p.length >= 8)),
  ).map((n) => `${n}@s.whatsapp.net`);
  if (!participants.length) return { ok: false, error: 'Aucun numéro valide' };
  return whapiRequest('PATCH', `/groups/${encodeURIComponent(id)}/admins`, { participants });
}

/** Épingle un message (POST /messages/{id}/pin). time: day | week | month. */
export async function pinWhapiMessage(
  messageId: string,
  time: 'day' | 'week' | 'month' = 'month',
): Promise<WhapiResult> {
  return whapiRequest('POST', `/messages/${encodeURIComponent(messageId)}/pin`, { time });
}

/** Envoie un message dans un groupe puis l'épingle (défaut 30 jours). */
export async function sendAndPinWhapiMessage(
  body: string,
  to: string,
  time: 'day' | 'week' | 'month' = 'month',
): Promise<WhapiResult> {
  const sent = await sendWhapiText(body, to);
  if (!sent.ok || !sent.messageId) return sent;
  const pinned = await pinWhapiMessage(sent.messageId, time);
  if (!pinned.ok) return { ok: true, messageId: sent.messageId, error: `Envoyé mais non épinglé : ${pinned.error}` };
  return { ok: true, messageId: sent.messageId };
}

// ----------------------------------------------------------------------------
// Catalogue WhatsApp Business (produits + collections) — endpoints /business
// ----------------------------------------------------------------------------

async function whapiBusinessCall<T = Record<string, unknown>>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  payload?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (!WHAPI_TOKEN) return { ok: false, error: 'WHAPI_TOKEN non configuré (variable d’environnement)' };
  try {
    const res = await fetch(`${WHAPI_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WHAPI_TOKEN}` },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: unknown };
    if (!res.ok) {
      return { ok: false, error: `Whapi ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 200)}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

export interface WhapiProductInput {
  name: string;
  description: string;
  price: number;
  currency: string; // ex: XAF
  images: string[]; // URLs publiques
  url?: string; // lien de la page listing
  retailerId?: string; // id produit Twinsk (clé de synchro)
}

/** Crée un produit dans le catalogue WhatsApp Business. Retourne l'id WhatsApp. */
export async function createWhapiProduct(
  p: WhapiProductInput,
): Promise<{ ok: boolean; productId?: string; error?: string }> {
  const r = await whapiBusinessCall<{ id?: string }>('POST', '/business/products', {
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    images: p.images,
    url: p.url,
    product_retailer_id: p.retailerId,
    availability: 'in stock',
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (!r.data?.id) return { ok: false, error: 'Produit créé mais id introuvable dans la réponse' };
  return { ok: true, productId: r.data.id };
}

/** Met à jour un produit du catalogue (prix, nom, images…). */
export async function updateWhapiProduct(
  productId: string,
  p: Partial<WhapiProductInput>,
): Promise<WhapiResult> {
  const payload: Record<string, unknown> = {};
  if (p.name !== undefined) payload.name = p.name;
  if (p.description !== undefined) payload.description = p.description;
  if (p.price !== undefined) payload.price = p.price;
  if (p.currency !== undefined) payload.currency = p.currency;
  if (p.images !== undefined) payload.images = p.images;
  if (p.url !== undefined) payload.url = p.url;
  const r = await whapiBusinessCall('PATCH', `/business/products/${encodeURIComponent(productId)}`, payload);
  return { ok: r.ok, error: r.error };
}

/** Supprime un produit du catalogue. */
export async function deleteWhapiProduct(productId: string): Promise<WhapiResult> {
  const r = await whapiBusinessCall('DELETE', `/business/products/${encodeURIComponent(productId)}`);
  return { ok: r.ok, error: r.error };
}

/** Crée une collection (regroupement de produits — une par listing). */
export async function createWhapiCollection(
  name: string,
  productIds: string[],
): Promise<{ ok: boolean; collectionId?: string; error?: string }> {
  const r = await whapiBusinessCall<{ id?: string; collection?: { id?: string } }>(
    'POST',
    '/business/collections',
    { name, products: productIds },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const id = r.data?.id || r.data?.collection?.id;
  return { ok: true, collectionId: id };
}

/** Configure l'URL de webhook WHAPI (PATCH /settings) pour recevoir les événements. */
export async function setWhapiWebhook(
  url: string,
  events: string[] = ['messages'],
): Promise<WhapiResult> {
  return whapiRequest('PATCH', '/settings', {
    webhooks: [
      {
        url,
        mode: 'body',
        events: events.map((type) => ({ type, method: 'post' })),
      },
    ],
  });
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

/** Envoie une vidéo (mp4, media = URL publique) avec légende optionnelle. */
export async function sendWhapiVideo(
  mediaUrl: string,
  caption: string | undefined,
  to: string = DEFAULT_GROUP_ID,
): Promise<WhapiResult> {
  return whapiPost('/messages/video', { to, media: mediaUrl, caption });
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
  steps: { media?: WhapiResult; message: WhapiResult };
  /** true si le message final est passé par le fallback texte (bouton échoué). */
  buttonFallback?: boolean;
}

/**
 * Diffuse une offre dans le groupe : média (VIDÉO mp4 prioritaire, sinon image)
 * PUIS message + bouton URL. Si le bouton échoue (instabilité WHAPI), repli sur
 * un message texte avec le lien.
 */
export async function broadcastOfferRich(args: {
  title: string;
  theme?: string | null;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  to?: string;
}): Promise<BroadcastResult> {
  const to = args.to ?? DEFAULT_GROUP_ID;
  const body = buildOfferBody(args);

  // 1) Média d'abord (best-effort) : vidéo prioritaire, sinon image.
  let media: WhapiResult | undefined;
  const hasMedia = !!(args.videoUrl || args.imageUrl);
  if (args.videoUrl) {
    media = await sendWhapiVideo(args.videoUrl, undefined, to);
  } else if (args.imageUrl) {
    media = await sendWhapiImage(args.imageUrl, undefined, to);
  }

  // 2) Message avec bouton URL, fallback texte + lien si échec.
  let buttonFallback = false;
  let message = await sendWhapiButtonLink({ body, buttonTitle: 'Voir l’offre', url: args.url, to });
  if (!message.ok) {
    buttonFallback = true;
    message = await sendWhapiText(`${body}\n\n👉 ${args.url}`, to);
  }

  const ok = message.ok && (hasMedia ? !!media?.ok : true);
  const error = !message.ok
    ? message.error
    : hasMedia && !media?.ok
      ? `Média non envoyé : ${media?.error}`
      : undefined;

  return { ok, error, steps: { media, message }, buttonFallback };
}
