import { Metadata } from 'next';
import OfferPublicView from '@/components/offer/OfferPublicView';

interface PageProps {
  params: Promise<{ uuid: string }>;
}

async function fetchOffer(uuid: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/offer-public/${uuid}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { uuid } = await params;
  const data = await fetchOffer(uuid);
  if (!data?.offer) return { title: 'Offre Twinsk' };
  return {
    title: `${data.offer.title} · Twinsk`,
    description: data.offer.description || data.offer.theme || undefined,
  };
}

export default async function OfferPublicPage({ params }: PageProps) {
  const { uuid } = await params;
  const data = await fetchOffer(uuid);

  if (!data?.offer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-xl font-bold text-slate-900">
            Offre introuvable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Cette offre n&apos;existe pas ou n&apos;est pas encore publique.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OfferPublicView offerId={uuid} offer={data.offer} items={data.items} />
    </div>
  );
}
