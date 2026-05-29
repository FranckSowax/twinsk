'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  FileJson,
  Loader2,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface BulkImportModalProps {
  open: boolean;
  requestId: string;
  onClose: () => void;
  onImported: () => void;
}

interface PreviewStats {
  categories: number;
  products: number;
  variants: number;
}

interface BulkResponse {
  success?: boolean;
  inserted?: { categories: number; products: number; variants: number };
  report?: { title: string; productsInserted: number; productsFailed: number; variantsInserted: number; errors: string[] }[];
  errors?: string[];
  error?: string;
}

function computePreview(json: string): { stats: PreviewStats | null; error: string | null } {
  const trimmed = json.trim();
  if (!trimmed) return { stats: null, error: null };
  try {
    const parsed = JSON.parse(trimmed) as {
      categories?: { products?: { variants?: unknown[] }[] }[];
    };
    if (!parsed || !Array.isArray(parsed.categories)) {
      return { stats: null, error: 'JSON valide mais sans tableau "categories"' };
    }
    let products = 0;
    let variants = 0;
    for (const c of parsed.categories) {
      const ps = Array.isArray(c.products) ? c.products : [];
      products += ps.length;
      for (const p of ps) {
        if (Array.isArray(p.variants)) variants += p.variants.length;
      }
    }
    return { stats: { categories: parsed.categories.length, products, variants }, error: null };
  } catch (err) {
    return { stats: null, error: err instanceof Error ? err.message : 'JSON invalide' };
  }
}

export default function BulkImportModal({
  open,
  requestId,
  onClose,
  onImported,
}: BulkImportModalProps) {
  const [json, setJson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BulkResponse | null>(null);

  useEffect(() => {
    if (open) {
      setJson('');
      setError('');
      setResult(null);
    }
  }, [open]);

  const preview = useMemo(() => computePreview(json), [json]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    setResult(null);
    if (!preview.stats) {
      setError(preview.error || 'JSON invalide');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/bulk-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      const data = (await res.json()) as BulkResponse;
      if (!res.ok || !data.success) {
        setError(data.error || 'Erreur import');
        setResult(data);
        return;
      }
      setResult(data);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
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
          onClick={handleClose}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-amber-500" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Importer un JSON de catégories + produits
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Format attendu :{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-slate-700">
                  {'{ categories: [{ title, description?, image_url?, products: [{ title, price, image_url, extra_images?, variants?, ... }] }] }'}
                </code>
              </p>

              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder='Collez votre JSON ici… ({ "categories": [...] })'
                spellCheck={false}
                className="h-72 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />

              {/* Live preview */}
              {json.trim() && (
                preview.stats ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    <span>
                      JSON valide :{' '}
                      <strong>{preview.stats.categories}</strong> catégorie(s) ·{' '}
                      <strong>{preview.stats.products}</strong> produit(s) ·{' '}
                      <strong>{preview.stats.variants}</strong> variante(s)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <span>{preview.error}</span>
                  </div>
                )
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              {result?.success && result.inserted && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Import réussi : {result.inserted.categories} catégorie(s),{' '}
                    {result.inserted.products} produit(s),{' '}
                    {result.inserted.variants} variante(s) chargées.
                  </p>
                  {result.errors && result.errors.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                      {result.errors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  )}
                  {result.report && result.report.some((r) => r.errors.length > 0) && (
                    <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
                      {result.report
                        .filter((r) => r.errors.length > 0)
                        .map((r, i) => (
                          <li key={i}>
                            <strong>{r.title}</strong> : {r.errors.join(' · ')}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                {result?.success ? 'Fermer' : 'Annuler'}
              </button>
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !preview.stats || !!result?.success}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Import en cours…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Importer
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
