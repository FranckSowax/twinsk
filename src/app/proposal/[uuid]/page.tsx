'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProposalView from '@/components/proposal/ProposalView';
import type { ProposalResult } from '@/components/proposal/ProposalDetailModal';

interface NoteItem {
  id: string;
  author: 'admin' | 'client';
  message: string | null;
  media_urls: string[] | null;
  created_at: string;
}

interface ProposalItem {
  id: string;
  image_url: string | null;
  description: string | null;
  client_note: string | null;
  notes?: NoteItem[];
  results: ProposalResult[];
}

interface ProposalData {
  request: {
    id: string;
    client_name: string;
    status: string;
    created_at: string;
    proposal_currency?: 'CNY' | 'USD' | 'EUR' | 'XAF';
    final_quote_id?: string | null;
  };
  items: ProposalItem[];
}

export default function ProposalPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const [data, setData] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/proposal/${uuid}`)
      .then((res) => {
        if (!res.ok) throw new Error('Proposition non trouvée');
        return res.json();
      })
      .then((d: ProposalData) => setData(d))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
            {error || 'Proposition non trouvée'}
          </p>
          <p className="mt-2 text-sm text-slate-500">Vérifiez le lien reçu de notre équipe.</p>
        </div>
      </div>
    );
  }

  if (!data.items.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
            La proposition n&apos;est pas encore prête
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Notre équipe finalise votre sélection. Revenez bientôt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-6 sm:py-10 dark:from-slate-900 dark:to-slate-800">
      {/* Logo header */}
      <header className="mx-auto mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
            <span className="text-lg font-bold text-white">T</span>
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-white">
              TWINSK
            </p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              Logistics & Sourcing
            </p>
          </div>
        </div>
      </header>

      {data.request.final_quote_id && (
        <div className="mx-auto mb-6 max-w-5xl">
          <a
            href={`/quote/${data.request.final_quote_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-2 rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 transition-all hover:shadow-lg dark:border-emerald-500 dark:from-emerald-900/30 dark:to-teal-900/30 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500 p-2.5 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                  Devis disponible
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Votre devis final avec transport est prêt à consulter.
                </p>
              </div>
            </div>
            <span className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              Ouvrir le devis →
            </span>
          </a>
        </div>
      )}

      <ProposalView
        requestId={data.request.id}
        clientName={data.request.client_name || 'Cher client'}
        createdAt={data.request.created_at}
        items={data.items}
        proposalCurrency={data.request.proposal_currency || 'CNY'}
      />
    </div>
  );
}
