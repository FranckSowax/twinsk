'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Loader2, Copy, Check, X, FileDown } from 'lucide-react';

export default function ExportOfferButton({ offerId, title }: { offerId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [json, setJson] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ categories: number; products: number } | null>(null);

  const openExport = async () => {
    setOpen(true);
    setLoading(true);
    setJson('');
    try {
      const res = await fetch(`/api/offers/${offerId}/export`);
      const data = await res.json();
      if (res.ok) {
        setJson(JSON.stringify(data, null, 2));
        const cats = Array.isArray(data.categories) ? data.categories : [];
        setStats({
          categories: cats.length,
          products: cats.reduce((s: number, c: { products?: unknown[] }) => s + (c.products?.length || 0), 0),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'offre').replace(/[^\w.-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={openExport}
        title="Exporter cette offre en JSON réimportable"
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
      >
        <FileDown className="h-4 w-4" />
        Exporter JSON
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
              className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                  <FileDown className="h-5 w-5 text-emerald-500" /> Exporter en JSON
                </h2>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <p className="mb-3 text-xs text-slate-500">
                  JSON réimportable (même format que « Importer JSON ») — pour reproduire cette offre ailleurs.
                  {stats && <span className="font-semibold"> {stats.categories} catégorie(s) · {stats.products} produit(s).</span>}
                </p>
                {loading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Génération…</div>
                ) : (
                  <pre className="max-h-[45vh] overflow-auto rounded-xl bg-slate-900 p-4 text-[11px] leading-relaxed text-emerald-100">{json}</pre>
                )}
              </div>

              {!loading && json && (
                <div className="flex gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                  <button onClick={copy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-slate-700">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copié !' : 'Copier'}
                  </button>
                  <button onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25">
                    <Download className="h-4 w-4" /> Télécharger .json
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
