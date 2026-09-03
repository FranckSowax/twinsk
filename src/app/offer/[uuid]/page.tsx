import { Metadata } from 'next';
import { headers } from 'next/headers';
import OfferPublicView from '@/components/offer/OfferPublicView';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import { buildOgImage } from '@/lib/og-image';
import { FX_RATES, roundXafUp } from '@/lib/utils/formatCurrency';

interface PageProps {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { uuid } = await params;
  const data = await fetchPublicOffer(uuid);
  if (!data?.offer) return { title: 'Offre Twinsk' };

  const host = (await headers()).get('host') || 'twinsk-production.up.railway.app';
  const origin = `https://${host}`;

  // Lien profond ?p=<id produit> : l'aperçu WhatsApp montre LE produit (photo,
  // titre, prix) plutôt que la cover du listing.
  const pParam = (await searchParams).p;
  const productId = Array.isArray(pParam) ? pParam[0] : pParam;
  const product = productId
    ? data.items.flatMap((it) => it.products).find((pr) => pr.id === productId)
    : undefined;

  if (product) {
    const price = product.on_quote || product.from_price <= 0
      ? 'Sur devis'
      : `À partir de ${Math.round(roundXafUp(product.from_price * FX_RATES.XAF)).toLocaleString('fr-FR')} FCFA`;
    const description = `${price} · ${data.offer.title}`;
    const ogImage = await buildOgImage(product.image_url, origin, product.title);
    const url = `${origin}/offer/${uuid}?p=${product.id}`;
    return {
      title: `${product.title} · Twinsk`,
      description,
      openGraph: {
        title: product.title,
        description,
        siteName: 'Twinsk',
        type: 'website',
        url,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
      twitter: {
        card: ogImage ? 'summary_large_image' : 'summary',
        title: product.title,
        description,
        ...(ogImage ? { images: [ogImage.url] } : {}),
      },
    };
  }

  const description = data.offer.description || data.offer.theme || undefined;
  // Aperçu WhatsApp/réseaux : cover du listing, sinon 1ʳᵉ image produit.
  const image =
    data.offer.cover_image_url || data.items[0]?.products[0]?.image_url || null;
  // URL absolue + proxy si CDN chinois + dimensions : sans width/height,
  // Facebook affiche la carte sans visuel au premier partage.
  const ogImage = await buildOgImage(image, origin, data.offer.title);

  return {
    title: `${data.offer.title} · Twinsk`,
    description,
    openGraph: {
      title: data.offer.title,
      description,
      siteName: 'Twinsk',
      type: 'website',
      url: `${origin}/offer/${uuid}`,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: data.offer.title,
      description,
      ...(ogImage ? { images: [ogImage.url] } : {}),
    },
  };
}

export default async function OfferPublicPage({ params }: PageProps) {
  const { uuid } = await params;
  const data = await fetchPublicOffer(uuid);

  if (!data?.offer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-xl font-bold text-slate-900">
            Offre indisponible
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Cette offre n&apos;existe pas, ou n&apos;a pas encore été publiée par
            l&apos;équipe Twinsk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OfferPublicView offerId={uuid} offer={data.offer} items={data.items} phases={data.phases} />
    </div>
  );
}
