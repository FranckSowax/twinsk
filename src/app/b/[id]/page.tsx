import { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';
import OfferPublicView from '@/components/offer/OfferPublicView';
import { fetchPublicOffer, type PublicOfferData } from '@/lib/offer-public-fetch';

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
  return { title: shop ? `${shop} · Boutique` : 'Boutique' };
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
        affiliate={{ ref: link.id, shopName }}
      />
    </div>
  );
}
