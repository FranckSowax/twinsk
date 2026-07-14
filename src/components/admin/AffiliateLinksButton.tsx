'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Store, X, Loader2, Copy, Check, Plus, ExternalLink } from 'lucide-react';

interface LinkRow {
  id: string;
  created_at: string;
  commission_percent: number;
  active: boolean;
  shop_name: string;
  airtel_number: string | null;
}

export default function AffiliateLinksButton({ offerId }: { offerId: string }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/offers/${offerId}/affiliate-link`);
      const data = await res.json();
      if (Array.isArray(data.links)) setLinks(data.links);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/offers/${offerId}/affiliate-link`, { method: 'POST' });
      if (res.ok) load();
    } finally {
      setCreating(false);
    }
  };

  const copy = async (key: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Partenaires marque blanche : liens affiliés de cette offre"
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
      >
        <Store className="h-4 w-4" />
        Marque blanche
        {links.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{links.length}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                  <Store className="h-5 w-5 text-emerald-500" /> Partenaires marque blanche
                </h2>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-4 text-xs text-slate-500">
                Créez un lien partenaire et envoyez-le à votre affilié : il inscrit sa boutique,
                fixe sa commission, masque/réordonne les produits et partage sa boutique.
                Les ventes lui sont attribuées (KPIs + notifications).
              </p>

              <button
                onClick={create}
                disabled={creating}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Créer un lien partenaire
              </button>

              {loading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
              ) : links.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Aucun partenaire pour cette offre.</p>
              ) : (
                <div className="space-y-3">
                  {links.map((l) => {
                    const manageUrl = `${origin}/partenaire/${l.id}`;
                    const shopUrl = `${origin}/b/${l.id}`;
                    return (
                      <div key={l.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {l.shop_name || <span className="italic text-slate-400">En attente d’inscription</span>}
                          </p>
                          <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            {Number(l.commission_percent) || 0} %
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => copy(`m-${l.id}`, manageUrl)}
                            className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white dark:bg-slate-700"
                          >
                            {copiedKey === `m-${l.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            Lien partenaire (gestion)
                          </button>
                          <button
                            onClick={() => copy(`s-${l.id}`, shopUrl)}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
                          >
                            {copiedKey === `s-${l.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            Lien boutique (public)
                          </button>
                          <a
                            href={shopUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
                          >
                            <ExternalLink className="h-3 w-3" /> Voir
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
