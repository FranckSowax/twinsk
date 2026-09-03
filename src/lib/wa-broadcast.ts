// Diffuseur multi-canal : une catégorie planifiée (DripPlan) est déclinée sur
// chaque canal actif. Chaque canal est indépendant — une erreur sur l'un
// n'empêche pas les autres — et remonte son propre bilan.
//
//   group     → groupe WhatsApp : en-tête, produits (fiche native si au
//               catalogue, sinon photo + légende), bouton « Voir le listing »
//   status    → statut WhatsApp du numéro : une story photo par produit
//   channel   → chaîne WhatsApp « Oh My Gab » : en-tête puis photos
//   facebook  → Page : une publication photo par produit + une story
//   instagram → compte pro : une publication photo par produit + une story

import { supabaseAdmin } from '@/lib/supabase/server';
import { facebookPostsFor, instagramPostsFor, productsFor, type DripChannel, type DripConfig, type DripPlan } from '@/lib/wa-drip';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import {
  postWhapiStory,
  sendWhapiButtonLink,
  sendWhapiImage,
  sendWhapiProduct,
  sendWhapiProductCard,
  sendWhapiText,
} from '@/lib/whapi';
import {
  fbPagePhotoPost,
  fbPageStory,
  igPhotoPost,
  igStory,
  metaFacebookConfigured,
  metaInstagramConfigured,
} from '@/lib/meta-graph';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = 1500;

export interface ChannelReport {
  sent: number;
  errors: string[];
  skipped?: 'disabled' | 'not_configured';
}
export type BroadcastReport = Record<DripChannel, ChannelReport>;

/** Image lisible par un service externe (Meta, WhatsApp) : proxifiée si CDN chinois. */
function publicImage(url: string, origin: string): string {
  const p = proxyImageUrl(url);
  return p.startsWith('/') ? `${origin}${p}` : p;
}

export async function broadcastCategory(
  plan: DripPlan,
  cfg: DripConfig,
  origin: string,
): Promise<BroadcastReport> {
  const report: BroadcastReport = {
    group: { sent: 0, errors: [] },
    status: { sent: 0, errors: [] },
    channel: { sent: 0, errors: [] },
    facebook: { sent: 0, errors: [] },
    instagram: { sent: 0, errors: [] },
  };
  const take = (c: DripChannel) => plan.products.slice(0, productsFor(cfg, c));
  const forGroup = take('group');

  // --- Groupe WhatsApp ---------------------------------------------------
  if (!cfg.channels.group) report.group.skipped = 'disabled';
  else if (!cfg.group_id) report.group.skipped = 'not_configured';
  else {
    const to = cfg.group_id;
    // Fiches déjà au catalogue → fiche native (prix, galerie, bouton « Voir »).
    const { data: mappings } = await supabaseAdmin
      .from('wa_catalog_products')
      .select('product_id, wa_product_id')
      .in('product_id', forGroup.map((p) => p.id));
    const waIds = new Map((mappings || []).map((m) => [m.product_id, m.wa_product_id]));

    const head = await sendWhapiText(plan.header, to);
    if (!head.ok) report.group.errors.push(`en-tête : ${head.error}`);
    await sleep(THROTTLE_MS);
    for (const p of forGroup) {
      const waId = waIds.get(p.id);
      // 1) Fiche native du catalogue si WHAPI la voit (prix, galerie, bouton « Voir »).
      let r = waId ? await sendWhapiProduct(waId, to) : { ok: false as const, error: 'pas au catalogue' };
      if (!r.ok && waId) {
        report.group.errors.push(`${p.title.slice(0, 40)} : fiche native indisponible (${r.error}), envoyée en carte`);
        await sleep(THROTTLE_MS);
      }
      // 2) Carte : photo + texte + bouton « Voir le produit » (un seul message).
      if (!r.ok) {
        r = await sendWhapiProductCard({
          imageUrl: p.imageUrl,
          body: p.cardBody,
          footer: plan.tagline,
          buttonTitle: 'Voir le produit',
          url: p.url,
          to,
        });
      }
      // 3) Repli si WhatsApp refuse les boutons : photo + légende avec le lien en clair.
      if (!r.ok) {
        await sleep(THROTTLE_MS);
        r = await sendWhapiImage(p.imageUrl, p.caption, to);
      }
      if (r.ok) report.group.sent += 1;
      else report.group.errors.push(`${p.title.slice(0, 40)} : ${r.error}`);
      await sleep(THROTTLE_MS);
    }
    const tail = await sendWhapiButtonLink({
      body: `Toute la catégorie *${plan.categoryTitle}* et le reste du listing :`,
      buttonTitle: 'Voir le listing',
      url: plan.offerUrl,
      to,
    });
    if (!tail.ok) await sendWhapiText(`👉 ${plan.offerUrl}`, to);
  }

  // --- Statut WhatsApp ---------------------------------------------------
  if (!cfg.channels.status) report.status.skipped = 'disabled';
  else {
    for (const p of take('status')) {
      const r = await postWhapiStory(p.imageUrl, p.social);
      if (r.ok) report.status.sent += 1;
      else report.status.errors.push(`${p.title.slice(0, 40)} : ${r.error}`);
      await sleep(THROTTLE_MS);
    }
  }

  // --- Chaîne WhatsApp ---------------------------------------------------
  if (!cfg.channels.channel) report.channel.skipped = 'disabled';
  else if (!cfg.channel_id) report.channel.skipped = 'not_configured';
  else {
    const to = cfg.channel_id;
    const head = await sendWhapiText(plan.header, to);
    if (!head.ok) report.channel.errors.push(`en-tête : ${head.error}`);
    await sleep(THROTTLE_MS);
    for (const p of take('channel')) {
      const r = await sendWhapiImage(p.imageUrl, p.caption, to);
      if (r.ok) report.channel.sent += 1;
      else report.channel.errors.push(`${p.title.slice(0, 40)} : ${r.error}`);
      await sleep(THROTTLE_MS);
    }
  }

  // --- Facebook (Page) ---------------------------------------------------
  if (!cfg.channels.facebook) report.facebook.skipped = 'disabled';
  else if (!metaFacebookConfigured()) report.facebook.skipped = 'not_configured';
  else {
    // Publications (restent dans le fil) et stories (24 h) ont chacune leur rythme.
    const posts = facebookPostsFor(cfg);
    const stories = take('facebook');
    for (let i = 0; i < stories.length; i++) {
      const p = stories[i];
      const img = publicImage(p.imageUrl, origin);
      if (i < posts) {
        const post = await fbPagePhotoPost({ imageUrl: img, message: `${plan.header.replace(/[*_]/g, '')}\n\n${p.social}` });
        if (post.ok) report.facebook.sent += 1;
        else report.facebook.errors.push(`post ${p.title.slice(0, 30)} : ${post.error}`);
      }
      const story = await fbPageStory({ imageUrl: img });
      if (story.ok) report.facebook.sent += 1;
      else report.facebook.errors.push(`story ${p.title.slice(0, 30)} : ${story.error}`);
      await sleep(THROTTLE_MS);
    }
  }

  // --- Instagram ---------------------------------------------------------
  if (!cfg.channels.instagram) report.instagram.skipped = 'disabled';
  else if (!metaInstagramConfigured()) report.instagram.skipped = 'not_configured';
  else {
    const igPosts = instagramPostsFor(cfg);
    const igItems = take('instagram');
    for (let i = 0; i < igItems.length; i++) {
      const p = igItems[i];
      const img = publicImage(p.imageUrl, origin);
      if (i < igPosts) {
        // Instagram n'accepte pas les liens cliquables dans les légendes : on
        // garde le texte, le lien reste lisible.
        const post = await igPhotoPost({ imageUrl: img, caption: `${plan.categoryTitle} · ${plan.offerTitle}\n\n${p.social}` });
        if (post.ok) report.instagram.sent += 1;
        else report.instagram.errors.push(`post ${p.title.slice(0, 30)} : ${post.error}`);
      }
      const story = await igStory({ imageUrl: img });
      if (story.ok) report.instagram.sent += 1;
      else report.instagram.errors.push(`story ${p.title.slice(0, 30)} : ${story.error}`);
      await sleep(THROTTLE_MS);
    }
  }

  return report;
}

/** Résumé d'une ligne pour le journal : « groupe 5 · statut 1 · chaîne ✗ (1 err.) ». */
export function summarizeReport(report: BroadcastReport): string {
  const labels: Record<DripChannel, string> = {
    group: 'groupe',
    status: 'statut',
    channel: 'chaîne',
    facebook: 'facebook',
    instagram: 'instagram',
  };
  return (Object.keys(report) as DripChannel[])
    .map((c) => {
      const r = report[c];
      if (r.skipped === 'disabled') return null;
      if (r.skipped === 'not_configured') return `${labels[c]} ⚙︎`;
      return `${labels[c]} ${r.sent}${r.errors.length ? ` (${r.errors.length} err.)` : ''}`;
    })
    .filter((x): x is string => !!x)
    .join(' · ');
}
