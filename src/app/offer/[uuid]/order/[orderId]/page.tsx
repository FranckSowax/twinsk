import OfferOrderView from '@/components/offer/OfferOrderView';

interface PageProps {
  params: Promise<{ uuid: string; orderId: string }>;
  searchParams: Promise<{ payment?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function OfferOrderPage({ params, searchParams }: PageProps) {
  const { uuid, orderId } = await params;
  const sp = await searchParams;
  return (
    <div className="min-h-screen bg-slate-50">
      <OfferOrderView
        offerId={uuid}
        orderId={orderId}
        paymentParam={sp.payment || null}
      />
    </div>
  );
}
