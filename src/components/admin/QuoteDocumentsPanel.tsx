'use client';

// Documents générés pour une demande (devis, listes de colisage, factures),
// avec la transformation d'un devis en facture. Réservé à l'admin (API).

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileDown, FileText, Loader2, Receipt } from 'lucide-react';
import { documentMeta, documentNumber, normalizeDocumentType } from '@/lib/quote-documents';
import { formatInCurrency, type CurrencyCode } from '@/lib/utils/formatCurrency';

interface DocRow {
  id: string;
  created_at: string;
  document_type: string;
  status: string;
  total_amount: number;
  invoice_id: string | null;
  source_quote_id: string | null;
}

const BADGE: Record<string, string> = {
  devis: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  facture: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  packing_list: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

export default function QuoteDocumentsPanel({ requestId, currency, refreshKey = 0 }: { requestId: string; currency: CurrencyCode; refreshKey?: number }) {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotes?request_id=${encodeURIComponent(requestId)}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setDocs(json.documents || []);
    else setError(json.error || 'Documents indisponibles');
  }, [requestId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const toInvoice = async (d: DocRow) => {
    if (!confirm(`Transformer le devis N° ${documentNumber('devis', d.id)} en facture ?\n\nLe contenu de la facture sera figé (produits, prix, quantités, client, transport) : les modifications ultérieures de la demande ne la changeront plus.`)) return;
    setBusy(d.id);
    setError('');
    try {
      const res = await fetch(`/api/quotes/${d.id}/invoice`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) { setError(json.error || 'Transformation impossible'); return; }
      window.open(`/quote/${json.id}`, '_blank');
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (docs === null && !error) return null;
  if (docs && docs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <FileText className="h-4 w-4 text-amber-500" /> Documents de la demande
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {(docs || []).map((d) => {
          const type = normalizeDocumentType(d.document_type);
          const meta = documentMeta(type);
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[type]}`}>{meta.title}</span>
              <span className="font-mono text-sm text-slate-900 dark:text-white">N° {documentNumber(type, d.id)}</span>
              <span className="text-xs text-slate-500">{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
              {type !== 'packing_list' && (
                <span className="text-xs text-slate-500">articles {formatInCurrency(d.total_amount, currency)} + transport</span>
              )}
              {type === 'facture' && d.source_quote_id && (
                <span className="text-xs text-slate-500">issue du devis N° {documentNumber('devis', d.source_quote_id)}</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                <a href={`/quote/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                  <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
                </a>
                <a href={`/api/quotes/${d.id}/pdf`} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </a>
                {type === 'devis' && (d.invoice_id ? (
                  <a href={`/quote/${d.invoice_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                    <Receipt className="h-3.5 w-3.5" /> Voir la facture
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => toInvoice(d)}
                    disabled={busy === d.id}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                    Transformer en facture
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
