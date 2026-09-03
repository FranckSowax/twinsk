import { Metadata } from 'next';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import OfferPublicView from '@/components/offer/OfferPublicView';
import { fetchPublicOffer, type PublicOfferData } from '@/lib/offer-public-fetch';
import { buildOgImage } from '@/lib/og-image';

// Boutique marque blanche d'un partenaire : /b/[affiliateOfferId].
// Prix majorés de la commission, produits masqués filtrés, ordre personnalisé,
// branding = nom de la boutique. Les commandes sont attribuées à l'affilié.

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

interface LinkRow {
  id: string;
  offer_id: string;
  commission_percent: number;
  hidden_product_ids: unknown;
  item_order: unknown;
  active: boolean;
  affiliates: { shop_name: string; active: boolean } | null;
}

async function loadLink(id: string): Promise<LinkRow | null> {
  const { data } = await supabaseAdmin
    .from('affiliate_offers')
    .select('id, offer_id, commission_percent, hidden_product_ids, item_order, active, affiliates(shop_name, active)')
    .eq('id', id)
    .single();
  return (data as unknown as LinkRow) || null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const link = await loadLink(id);
  const shop = link?.affiliates?.shop_name;
  const title = shop ? `${shop} · Boutique` : 'Boutique';
  if (!link) return { title };
  // Aperçu WhatsApp/réseaux : cover du listing source (lecture légère, sans produits).
  const { data: offer } = await supabaseAdmin
    .from('offers')
    .select('title, description, theme, cover_image_url')
    .eq('id', link.offer_id)
    .single();
  const description = offer?.description || offer?.theme || undefined;
  const image = offer?.cover_image_url || null;
  const ogTitle = shop || offer?.title || 'Boutique';

  const host = (await headers()).get('host') || 'twinsk-production.up.railway.app';
  const origin = `https://${host}`;
  // Même traitement que /offer : sans width/height, Facebook affiche la carte
  // sans visuel au premier partage.
  const ogImage = await buildOgImage(image, origin, ogTitle);

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      siteName: shop || 'Boutique',
      type: 'website',
      url: `${origin}/b/${id}`,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description,
      ...(ogImage ? { images: [ogImage.url] } : {}),
    },
  };
}

// Applique la commission (majoration %) à un prix CNY.
function scale(v: number, mult: number): number;
function scale(v: number | null, mult: number): number | null;
function scale(v: number | null, mult: number): number | null {
  return v == null ? null : Math.round(v * mult * 100) / 100;
}

export default async function WhiteLabelOfferPage({ params }: PageProps) {
  const { id } = await params;
  const link = await loadLink(id);

  const unavailable = (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold text-slate-900">Boutique indisponible</h1>
        <p className="mt-2 text-sm text-slate-500">Ce lien n&apos;existe pas ou a été désactivé.</p>
      </div>
    </div>
  );

  if (!link || link.active === false || link.affiliates?.active === false) return unavailable;

  const data: PublicOfferData | null = await fetchPublicOffer(link.offer_id);
  if (!data?.offer) return unavailable;

  const mult = 1 + (Number(link.commission_percent) || 0) / 100;
  const hidden = new Set(
    (Array.isArray(link.hidden_product_ids) ? link.hidden_product_ids : []).filter(
      (v): v is string => typeof v === 'string',
    ),
  );

  // Filtre les produits masqués + applique la commission sur tous les prix.
  let items = data.items
    .map((it) => ({
      ...it,
      products: it.products
        .filter((p) => !hidden.has(p.id))
        .map((p) => ({
          ...p,
          price: scale(p.price, mult),
          from_price: scale(p.from_price, mult) as number,
          price_tiers: p.price_tiers
            ? p.price_tiers.map((t) => ({ ...t, price: scale(t.price, mult) as number }))
            : p.price_tiers,
          variants: p.variants
            ? p.variants.map((v) => ({ ...v, price: scale(v.price, mult) }))
            : p.variants,
        })),
    }))
    .filter((it) => it.products.length > 0);

  // Ordre des catégories personnalisé par le partenaire.
  const order = Array.isArray(link.item_order)
    ? (link.item_order.filter((v): v is string => typeof v === 'string'))
    : null;
  if (order?.length) {
    const rank = new Map(order.map((itemId, i) => [itemId, i]));
    items = [...items].sort(
      (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
    );
  }

  const shopName = link.affiliates?.shop_name || 'Boutique';

  return (
    <div className="min-h-screen bg-slate-50">
      <OfferPublicView
        offerId={link.offer_id}
        offer={data.offer}
        items={items}
        phases={data.phases}
        affiliate={{ ref: link.id, shopName }}
      />
    </div>
  );
}
