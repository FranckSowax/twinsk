'use client';

// Documents générés pour une demande (devis, listes de colisage, factures),
// avec la transformation d'un devis en facture. Réservé à l'admin (API).

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileDown, FileText, Loader2, Receipt } from 'lucide-react';
import { documentMeta, documentNumber, normalizeDocumentType } from '@/lib/quote-documents';
import { formatInCurrency, type CurrencyCode } from '@/lib/utils/formatCurrency';
import { DEFAULT_SEA_OVERRIDE_AMOUNT, DEFAULT_SEA_OVERRIDE_CURRENCY, DEFAULT_SEA_OVERRIDE_LABEL } from '@/lib/quote-transport';

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

  // Une facture porte toujours le FORFAIT MARITIME NÉGOCIÉ, jamais un calcul au
  // CBM : le formulaire s'ouvre sous la ligne du devis. Montant laissé vide =
  // on reprend le forfait déjà fixé sur le devis.
  const [invoiceFor, setInvoiceFor] = useState<DocRow | null>(null);
  const [sea, setSea] = useState({
    amount: String(DEFAULT_SEA_OVERRIDE_AMOUNT),
    currency: DEFAULT_SEA_OVERRIDE_CURRENCY as CurrencyCode,
    label: DEFAULT_SEA_OVERRIDE_LABEL,
    containers: '1',
  });

  const toInvoice = async (d: DocRow) => {
    const typed = sea.amount.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    const amount = typed ? Number(typed) : null;
    if (typed && (!Number.isFinite(amount) || (amount as number) <= 0)) { setError('Montant du forfait maritime invalide.'); return; }
    const containers = Math.max(1, Math.trunc(Number(sea.containers) || 1));
    if (!confirm(`Transformer le devis N° ${documentNumber('devis', d.id)} en facture ?\n\nTransport facturé : ${amount != null ? `${amount.toLocaleString('fr-FR')} ${sea.currency}${containers > 1 ? ` (${containers} conteneurs)` : ''}` : 'le forfait déjà fixé sur le devis'} — forfait négocié, sans calcul au CBM.\nLe contenu de la facture sera figé (produits, prix, quantités, client, transport) : les modifications ultérieures de la demande ne la changeront plus.`)) return;
    setBusy(d.id);
    setError('');
    try {
      const res = await fetch(`/api/quotes/${d.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(amount != null ? { sea_override: { amount, currency: sea.currency, label: sea.label, containers } } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) { setError(json.error || 'Transformation impossible'); return; }
      setInvoiceFor(null);
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
                    onClick={() => { setError(''); setInvoiceFor(invoiceFor?.id === d.id ? null : d); }}
                    disabled={busy === d.id}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                    Transformer en facture
                  </button>
                ))}
              </span>
              {invoiceFor?.id === d.id && (
                <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">Forfait maritime négocié de la facture</p>
                  <p className="mb-2 text-[11px] text-slate-600 dark:text-slate-300">Le prix convenu avec le transitaire : c&apos;est lui qui figure sur la facture, sans calcul au CBM, au poids ni au conteneur. Laissez le montant vide pour reprendre le forfait déjà fixé sur le devis.</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Montant</span>
                      <input inputMode="decimal" autoFocus value={sea.amount} onChange={(e) => setSea({ ...sea, amount: e.target.value })} placeholder="forfait du devis" className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:py-2 sm:text-sm" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Devise</span>
                      <select value={sea.currency} onChange={(e) => setSea({ ...sea, currency: e.target.value as CurrencyCode })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:py-2 sm:text-sm">
                        {(['USD', 'EUR', 'XAF', 'CNY'] as CurrencyCode[]).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Conteneurs</span>
                      <input inputMode="numeric" value={sea.containers} onChange={(e) => setSea({ ...sea, containers: e.target.value })} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:py-2 sm:text-sm" />
                    </label>
                    <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Libellé sur la facture</span>
                      <input value={sea.label} onChange={(e) => setSea({ ...sea, label: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:py-2 sm:text-sm" />
                    </label>
                    <button type="button" disabled={busy === d.id} onClick={() => toInvoice(d)} className="flex min-h-10 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:min-h-0 sm:py-2 sm:text-xs">
                      {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Créer la facture
                    </button>
                    <button type="button" onClick={() => setInvoiceFor(null)} className="min-h-10 px-2 text-sm font-semibold text-slate-500 underline sm:min-h-0 sm:text-xs">Annuler</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
