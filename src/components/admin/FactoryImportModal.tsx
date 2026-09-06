'use client';

// Import d'un dossier « usines » (JSON de classement d'ateliers 1688).
// Même agencement que BulkImportModal (offres B2C / B2B) : collage ou fichier,
// aperçu avant écriture, compte-rendu après import.

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apercuDossier } from '@/lib/factories';

interface FactoryImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (id: string) => void;
}

interface ImportResponse {
  success?: boolean;
  id?: string;
  label?: string;
  inserted?: { usines: number; ecartes: number };
  error?: string;
}

function lireApercu(json: string) {
  const trimmed = json.trim();
  if (!trimmed) return { apercu: null, error: null as string | null };
  try {
    const apercu = apercuDossier(JSON.parse(trimmed));
    if (!apercu) return { apercu: null, error: 'JSON valide mais sans tableau « usines »' };
    return { apercu, error: null };
  } catch (err) {
    return { apercu: null, error: err instanceof Error ? err.message : 'JSON invalide' };
  }
}

export default function FactoryImportModal({ open, onClose, onImported }: FactoryImportModalProps) {
  const [json, setJson] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResponse | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setJson('');
      setLabel('');
      setError('');
      setResult(null);
    }
  }, [open]);

  const preview = useMemo(() => lireApercu(json), [json]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const chargerFichier = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setResult(null);
    setJson(await file.text());
    // Le nom du fichier fait un libellé de départ correct, sans extension.
    if (!label.trim()) setLabel(file.name.replace(/\.json$/i, ''));
  };

  const handleSubmit = async () => {
    setError('');
    setResult(null);
    if (!preview.apercu) {
      setError(preview.error || 'JSON invalide');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/usines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || null, payload: JSON.parse(json) }),
      });
      const data = (await res.json()) as ImportResponse;
      if (!res.ok || !data.success) {
        setError(data.error || 'Erreur import');
        return;
      }
      setResult(data);
      if (data.id) onImported(data.id);
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
                <FileJson className="h-5 w-5 text-sky-500" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Importer un dossier d’usines
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
                  {'{ meta: { objet, devise, bassins_industriels… }, usines: [{ rang, nom_fr, credit_1688, note_service, reachat… }], ecartes: [], a_demander_a_chaque_usine: [] }'}
                </code>
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[16rem] flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Libellé du dossier (optionnel)
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Repris de meta.objet si laissé vide"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <input
                  ref={fichierRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => chargerFichier(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fichierRef.current?.click()}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Choisir un fichier .json
                </button>
              </div>

              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder='Collez le JSON ici… ({ "meta": {…}, "usines": [...] })'
                spellCheck={false}
                className="h-72 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />

              {json.trim() &&
                (preview.apercu ? (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <span>
                      JSON valide : <strong>{preview.apercu.usines}</strong> usine(s) ·{' '}
                      <strong>{preview.apercu.ecartes}</strong> écartée(s) ·{' '}
                      <strong>{preview.apercu.bassins}</strong> bassin(s) industriel(s)
                      {preview.apercu.objet && (
                        <span className="mt-0.5 block text-xs opacity-80">{preview.apercu.objet}</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <span>{preview.error}</span>
                  </div>
                ))}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              {result?.success && result.inserted && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Dossier importé : {result.inserted.usines} usine(s) classée(s),{' '}
                    {result.inserted.ecartes} écartée(s).
                  </p>
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
                disabled={submitting || !preview.apercu || !!result?.success}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 disabled:opacity-60"
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
