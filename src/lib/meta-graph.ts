// Publication organique sur la Page Facebook et le compte Instagram professionnel
// via l'API Graph (pas le MCP Ads : un cron ne peut pas l'appeler, et il ne sait
// pas publier de post organique).
//
// Variables Railway attendues :
//   META_PAGE_ID     — id de la Page (Oh My Gab : 1755823391163318)
//   META_PAGE_TOKEN  — jeton de Page longue durée (pages_manage_posts,
//                      pages_read_engagement, instagram_basic,
//                      instagram_content_publish)
//   META_IG_USER_ID  — id du compte Instagram professionnel relié à la Page
//
// Sans jeton, chaque fonction renvoie { ok:false, skipped:'not_configured' } :
// le diffuseur passe simplement le canal.

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface MetaResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: 'not_configured';
}

function pageId(): string | null {
  return process.env.META_PAGE_ID || null;
}
function token(): string | null {
  return process.env.META_PAGE_TOKEN || null;
}
function igUserId(): string | null {
  return process.env.META_IG_USER_ID || null;
}

export function metaFacebookConfigured(): boolean {
  return !!(pageId() && token());
}
export function metaInstagramConfigured(): boolean {
  return !!(igUserId() && token());
}

async function graphPost(path: string, params: Record<string, string>): Promise<MetaResult> {
  const t = token();
  if (!t) return { ok: false, skipped: 'not_configured' };
  try {
    const body = new URLSearchParams({ ...params, access_token: t });
    const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string; code?: number } };
    if (!res.ok || data.error) {
      const e = data.error;
      return { ok: false, error: `Graph ${res.status}: ${e?.message || 'erreur inconnue'}${e?.code ? ` (code ${e.code})` : ''}`.slice(0, 300) };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

/** Publication photo sur la Page (fil d'actualité). */
export async function fbPagePhotoPost(args: { imageUrl: string; message: string }): Promise<MetaResult> {
  const p = pageId();
  if (!p) return { ok: false, skipped: 'not_configured' };
  return graphPost(`${p}/photos`, { url: args.imageUrl, message: args.message });
}

/**
 * Story photo sur la Page : la photo est d'abord téléversée non publiée, puis
 * attachée à une story (POST /{page}/photo_stories).
 */
export async function fbPageStory(args: { imageUrl: string }): Promise<MetaResult> {
  const p = pageId();
  if (!p) return { ok: false, skipped: 'not_configured' };
  const upload = await graphPost(`${p}/photos`, { url: args.imageUrl, published: 'false' });
  if (!upload.ok || !upload.id) return upload;
  return graphPost(`${p}/photo_stories`, { photo_id: upload.id });
}

/**
 * Instagram traite le média en arrière-plan : publier avant que le conteneur
 * soit FINISHED renvoie « Media ID is not available (9007) ». On attend.
 */
async function waitIgContainer(containerId: string, maxWaitMs = 45000): Promise<MetaResult> {
  const t = token();
  if (!t) return { ok: false, skipped: 'not_configured' };
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const res = await fetch(`${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(t)}`);
      const data = (await res.json().catch(() => ({}))) as { status_code?: string; status?: string; error?: { message?: string } };
      if (data.error) return { ok: false, error: `Graph: ${data.error.message}`.slice(0, 300) };
      if (data.status_code === 'FINISHED') return { ok: true, id: containerId };
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        return { ok: false, error: `Instagram : conteneur ${data.status_code} — ${data.status || 'média refusé'}`.slice(0, 300) };
      }
    } catch (err) {
      return { ok: false, error: String(err).slice(0, 200) };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: false, error: 'Instagram : média toujours en traitement après 45 s' };
}

async function igPublish(ig: string, containerId: string): Promise<MetaResult> {
  const ready = await waitIgContainer(containerId);
  if (!ready.ok) return ready;
  return graphPost(`${ig}/media_publish`, { creation_id: containerId });
}

/** Publication photo Instagram : conteneur, attente du traitement, publication. */
export async function igPhotoPost(args: { imageUrl: string; caption: string }): Promise<MetaResult> {
  const ig = igUserId();
  if (!ig) return { ok: false, skipped: 'not_configured' };
  const container = await graphPost(`${ig}/media`, { image_url: args.imageUrl, caption: args.caption });
  if (!container.ok || !container.id) return container;
  return igPublish(ig, container.id);
}

/** Story photo Instagram (compte professionnel). */
export async function igStory(args: { imageUrl: string }): Promise<MetaResult> {
  const ig = igUserId();
  if (!ig) return { ok: false, skipped: 'not_configured' };
  const container = await graphPost(`${ig}/media`, { image_url: args.imageUrl, media_type: 'STORIES' });
  if (!container.ok || !container.id) return container;
  return igPublish(ig, container.id);
}
