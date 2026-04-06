import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import RequestForm from '@/components/request/RequestForm';

interface Props {
  params: Promise<{ uuid: string }>;
}

export default async function RequestPage({ params }: Props) {
  const { uuid } = await params;

  const { data: request, error } = await supabaseAdmin
    .from('requests')
    .select('*')
    .eq('id', uuid)
    .single();

  if (error || !request) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <span className="text-lg font-bold text-white">T</span>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                TWINSK
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Demande de sourcing
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Votre demande de sourcing
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Envoyez-nous les photos des produits que vous recherchez. Notre équipe se charge
            de trouver les meilleurs fournisseurs et de vous proposer un devis détaillé.
          </p>
        </div>

        <RequestForm
          requestId={uuid}
          initialData={{
            client_name: request.client_name,
            client_email: request.client_email,
            client_phone: request.client_phone,
            notes: request.notes,
            status: request.status,
          }}
        />
      </main>
    </div>
  );
}
