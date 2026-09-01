import { Metadata } from 'next';
import OfferPublicView from '@/components/offer/OfferPublicView';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';

interface PageProps {
  params: Promise<{ uuid: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { uuid } = await params;
  const data = await fetchPublicOffer(uuid);
  if (!data?.offer) return { title: 'Offre Twinsk' };
  const description = data.offer.description || data.offer.theme || undefined;
  // Aperçu WhatsApp/réseaux : cover du listing, sinon 1ʳᵉ image produit.
  const image =
    data.offer.cover_image_url || data.items[0]?.products[0]?.image_url || null;
  return {
    title: `${data.offer.title} · Twinsk`,
    description,
    openGraph: {
      title: data.offer.title,
      description,
      siteName: 'Twinsk',
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: data.offer.title,
      description,
      ...(image ? { images: [image] } : {}),
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
