'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, Check, PackagePlus, ArrowLeft, ChevronRight } from 'lucide-react';
import { formatCNY } from '@/lib/utils/formatCurrency';

interface OfferListItem {
  id: string;
  title: string;
  status: string;
}
interface SrcProduct {
  id: string;
  title: string;
  image_url: string;
  main_image_url: string | null;
  price: number | null;
  variants: unknown[] | null;
}
interface SrcCategory {
  id: string;
  description: string | null;
  search_results: SrcProduct[];
}
interface TargetCategory {
  id: string;
  description: string | null;
}

export default function ImportFromOfferModal({
  open,
  currentUuid,
  targetCategories,
  onClose,
  onImported,
}: {
  open: boolean;
  currentUuid: string;
  targetCategories: TargetCategory[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState('');
  const [cats, setCats] = useState<SrcCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [targetItemId, setTargetItemId] = useState<string>(''); // '' = nouvelle « Produits importés »
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setSourceId(null);
    setSourceTitle('');
    setCats([]);
    setPicked(new Set());
    setError('');
  }, []);

  // Charge la liste des offres à l'ouverture.
  useEffect(() => {
    if (!open) return;
    reset();
    setLoadingOffers(true);
    fetch('/api/offers')
      .then((r) => r.json())
      .then((data) => {
        const list = (Array.isArray(data) ? data : data.offers || []) as OfferListItem[];
        setOffers(list.filter((o) => o.id !== currentUuid));
      })
      .catch(() => {})
      .finally(() => setLoadingOffers(false));
  }, [open, currentUuid, reset]);

  const openSource = async (o: OfferListItem) => {
    setSourceId(o.id);
    setSourceTitle(o.title);
    setPicked(new Set());
    setLoadingCats(true);
    try {
      const res = await fetch(`/api/offers/${o.id}/results`);
      const data = await res.json();
      if (Array.isArray(data)) setCats(data as SrcCategory[]);
    } finally {
      setLoadingCats(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleCategory = (cat: SrcCategory) => {
    const catIds = cat.search_results.map((p) => p.id);
    const allPicked = catIds.every((id) => picked.has(id));
    setPicked((prev) => {
      const next = new Set(prev);
      catIds.forEach((id) => (allPicked ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const submit = async () => {
    if (!picked.size) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/offers/${currentUuid}/import-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_product_ids: [...picked],
          target_item_id: targetItemId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur import');
        return;
      }
      onImported();
      onClose();
    } catch {
      setError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {sourceId && (
                  <button onClick={reset} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <PackagePlus className="h-5 w-5 text-emerald-500" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {sourceId ? sourceTitle : 'Importer depuis une autre offre'}
                </h2>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {!sourceId ? (
                // Étape 1 : choisir l'offre source
                loadingOffers ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
                ) : offers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">Aucune autre offre disponible.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Choisissez l’offre à copier</p>
                    {offers.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => openSource(o)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{o.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{o.status}</span>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )
              ) : loadingCats ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des produits…</div>
              ) : (
                // Étape 2 : sélectionner les produits
                <div className="space-y-4">
                  {cats.map((cat) => {
                    const catIds = cat.search_results.map((p) => p.id);
                    const allPicked = catIds.length > 0 && catIds.every((id) => picked.has(id));
                    return (
                      <div key={cat.id}>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cat.description || 'Catégorie'}</p>
                          {catIds.length > 0 && (
                            <button onClick={() => toggleCategory(cat)} className="text-[11px] font-semibold text-emerald-600 hover:underline">
                              {allPicked ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {cat.search_results.map((p) => {
                            const on = picked.has(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => toggle(p.id)}
                                className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${on ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/15' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}
                              >
                                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                                  {on && <Check className="h-3 w-3" />}
                                </span>
                                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                                  {(p.main_image_url || p.image_url) && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.main_image_url || p.image_url} alt="" className="h-full w-full object-cover" />
                                  )}
                                </div>
                                <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">{p.title}</span>
                                {p.price != null && <span className="flex-shrink-0 text-xs font-semibold text-amber-600">{formatCNY(p.price)}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {cats.every((c) => c.search_results.length === 0) && (
                    <p className="py-6 text-center text-sm text-slate-400">Cette offre n’a pas de produits.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer (étape 2) */}
            {sourceId && !loadingCats && (
              <div className="space-y-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                    Destination :
                    <select
                      value={targetItemId}
                      onChange={(e) => setTargetItemId(e.target.value)}
                      className="w-full min-w-0 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">Nouvelle catégorie « Produits importés »</option>
                      {targetCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {(c.description || 'Catégorie').slice(0, 60)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={submit}
                    disabled={submitting || picked.size === 0}
                    className="flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                    Ajouter ({picked.size})
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
