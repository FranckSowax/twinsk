import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import FreightForm from '@/components/freight/FreightForm';
import FreightQuoteView from '@/components/freight/FreightQuoteView';

interface Props {
  params: Promise<{ uuid: string }>;
}

export default async function FreightPage({ params }: Props) {
  const { uuid } = await params;

  const { data: row, error } = await supabaseAdmin
    .from('freight_requests')
    .select('*')
    .eq('id', uuid)
    .single();

  if (error || !row) {
    notFound();
  }

  const showQuote =
    (row.status === 'quoted' || row.status === 'completed') && Number(row.quote_total) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <span className="text-lg font-bold text-white">T</span>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">TWINSK</h1>
              <p className="text-xs text-slate-500">
                {showQuote ? 'Votre devis de fret' : 'Demande de fret & logistique'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {showQuote ? (
          <>
            <div className="mb-8">
              <h1 className="font-display text-3xl uppercase tracking-tight text-slate-900">
                Bonjour {row.client_name?.split(' ')[0] || ''} 👋
              </h1>
              <p className="mt-2 text-slate-600">
                Voici votre devis de fret. Vous pouvez l&apos;accepter et payer, ou demander
                des modifications.
              </p>
            </div>
            <FreightQuoteView
              data={{
                id: row.id,
                client_name: row.client_name,
                destination: row.destination,
                mode: row.mode,
                sea_service: row.sea_service,
                weight: Number(row.weight) || 0,
                volume: Number(row.volume) || 0,
                goods_nature: row.goods_nature,
                quote_base_price: Number(row.quote_base_price) || 0,
                quote_service_fee: Number(row.quote_service_fee) || 0,
                quote_customs_fee: Number(row.quote_customs_fee) || 0,
                quote_other_fees: Array.isArray(row.quote_other_fees)
                  ? row.quote_other_fees
                  : [],
                quote_total: Number(row.quote_total) || 0,
                quote_currency: row.quote_currency || 'USD',
                quote_transit_days: Number(row.quote_transit_days) || 0,
                quote_terms: row.quote_terms || '',
                quote_payment_link: row.quote_payment_link || '',
                quote_sent_at: row.quote_sent_at,
                client_decision: row.client_decision,
                client_message: row.client_message,
                status: row.status,
              }}
            />
          </>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="font-display text-3xl uppercase tracking-tight text-slate-900">
                Votre demande de <span className="text-amber-500">fret</span>
              </h1>
              <p className="mt-2 text-slate-600">
                Complétez les informations ci-dessous pour recevoir un devis personnalisé sous 48 h.
              </p>
            </div>

            <FreightForm
              freightId={uuid}
              initialData={{
                client_name: row.client_name,
                client_email: row.client_email,
                client_phone: row.client_phone,
                mode: row.mode,
                sea_service: row.sea_service,
                origin: row.origin,
                destination: row.destination,
                weight: Number(row.weight) || 0,
                volume: Number(row.volume) || 0,
                goods_nature: row.goods_nature,
                goods_description: row.goods_description,
                photos: Array.isArray(row.photos) ? row.photos : [],
                supplier_name: row.supplier_name ?? '',
                supplier_address: row.supplier_address ?? '',
                supplier_wechat: row.supplier_wechat ?? '',
                estimated_price: Number(row.estimated_price) || 0,
                estimated_days: Number(row.estimated_days) || 0,
                status: row.status,
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
