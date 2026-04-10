'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, CheckCircle, RefreshCw, AlertTriangle, Square } from 'lucide-react';

const DELAY_BETWEEN_CYCLES_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SearchTriggerProps {
  requestId: string;
  onSearchComplete: () => void;
}

export default function SearchTrigger({ requestId, onSearchComplete }: SearchTriggerProps) {
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [processedSoFar, setProcessedSoFar] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const runSearchLoop = useCallback(async (reset: boolean) => {
    if (reset) setRetrying(true);
    else setRunning(true);
    setError(null);
    setResult(null);
    setWarnings([]);
    setProcessedSoFar(0);
    setTotalResults(0);
    cancelRef.current = false;

    const allWarnings = new Set<string>();

    try {
      // Step 1: reset if requested
      if (reset) {
        const resetRes = await fetch(`/api/requests/${requestId}/reset-search`, {
          method: 'POST',
        });
        if (!resetRes.ok) {
          const resetData = await resetRes.json().catch(() => ({}));
          throw new Error(resetData.error || 'Erreur reset');
        }
        setRetrying(false);
        setRunning(true);
      }

      // Step 2: loop search calls until everything is processed
      let cumProcessed = 0;
      let cumResults = 0;

      while (!cancelRef.current) {
        const res = await fetch(`/api/requests/${requestId}/search`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Erreur recherche');
        }

        // Accumulate
        cumProcessed += data.processed_items || 0;
        cumResults += data.results_count || 0;
        const skipped = data.skipped_items || 0;

        setProcessedSoFar(cumProcessed);
        setTotalItems(cumProcessed + skipped);
        setTotalResults(cumResults);

        // Collect warnings
        if (Array.isArray(data.errors)) {
          data.errors.forEach((e: string) => allWarnings.add(e));
        }

        onSearchComplete();

        // Stop conditions
        if (skipped <= 0) break; // all done
        if ((data.processed_items || 0) === 0) break; // stuck, no progress

        // Pause between cycles to respect API rate limits
        await sleep(DELAY_BETWEEN_CYCLES_MS);
      }

      if (cancelRef.current) {
        setResult(`Recherche arrêtée: ${cumResults} résultats sur ${cumProcessed} article(s) traité(s)`);
      } else {
        setResult(`Recherche terminée: ${cumResults} résultats sur ${cumProcessed} article(s) traité(s)`);
      }

      if (allWarnings.size > 0) {
        setWarnings(Array.from(allWarnings));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche');
    } finally {
      setRunning(false);
      setRetrying(false);
    }
  }, [requestId, onSearchComplete]);

  const handleRetry = () => {
    if (!window.confirm('Cela va supprimer tous les résultats actuels et relancer la recherche complète. Continuer ?')) return;
    runSearchLoop(true);
  };

  const isActive = running || retrying;
  const pct = totalItems > 0 ? Math.round((processedSoFar / totalItems) * 100) : 0;

  return (
    <div className="space-y-3">
      {!isActive ? (
        <div className="flex flex-wrap gap-2">
          <motion.button
            type="button"
            onClick={() => runSearchLoop(false)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/25"
          >
            <Search className="h-5 w-5" />
            Recherche
          </motion.button>

          <motion.button
            type="button"
            onClick={handleRetry}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl border-2 border-cyan-300 bg-white px-5 py-3 text-sm font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:bg-slate-800 dark:text-cyan-300 dark:hover:bg-slate-700"
            title="Supprime les résultats actuels et relance la recherche"
          >
            <RefreshCw className="h-4 w-4" />
            Relancer
          </motion.button>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 dark:border-cyan-800 dark:bg-cyan-900/10">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {retrying ? 'Réinitialisation...' : `Recherche ${processedSoFar}/${totalItems} articles · ${totalResults} résultats`}
            </p>
            <button
              type="button"
              onClick={() => { cancelRef.current = true; }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <Square className="h-3 w-3" /> Arrêter
            </button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cyan-200 dark:bg-cyan-900/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-cyan-600 dark:text-cyan-400">{pct}%</p>
        </div>
      )}

      {!isActive && result && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
        >
          <CheckCircle className="h-4 w-4" />
          {result}
        </motion.p>
      )}

      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20"
        >
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Avertissements
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-amber-700 dark:text-amber-300">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
