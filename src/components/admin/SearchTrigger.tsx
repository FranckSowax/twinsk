'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, CheckCircle, RefreshCw } from 'lucide-react';

interface SearchTriggerProps {
  requestId: string;
  onSearchComplete: () => void;
}

export default function SearchTrigger({ requestId, onSearchComplete }: SearchTriggerProps) {
  const [searching, setSearching] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (reset: boolean) => {
    if (reset) setRetrying(true);
    else setSearching(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: reset (fast, no external APIs) if requested
      if (reset) {
        const resetRes = await fetch(`/api/requests/${requestId}/reset-search`, {
          method: 'POST',
        });
        if (!resetRes.ok) {
          const resetData = await resetRes.json().catch(() => ({}));
          throw new Error(resetData.error || 'Erreur reset');
        }
      }

      // Step 2: run the search
      const res = await fetch(`/api/requests/${requestId}/search`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur recherche');
      }

      setResult(data.message);
      onSearchComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche');
    } finally {
      setSearching(false);
      setRetrying(false);
    }
  };

  const handleRetry = () => {
    if (
      !window.confirm(
        'Cela va supprimer tous les résultats actuels et relancer la recherche complète. Continuer ?'
      )
    )
      return;
    runSearch(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <motion.button
          type="button"
          onClick={() => runSearch(false)}
          disabled={searching || retrying}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 disabled:opacity-60"
        >
          {searching ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Recherche en cours...
            </>
          ) : (
            <>
              <Search className="h-5 w-5" />
              Recherche
            </>
          )}
        </motion.button>

        <motion.button
          type="button"
          onClick={handleRetry}
          disabled={searching || retrying}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border-2 border-cyan-300 bg-white px-5 py-3 text-sm font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-60 dark:border-cyan-700 dark:bg-slate-800 dark:text-cyan-300 dark:hover:bg-slate-700"
          title="Supprime les résultats actuels et relance la recherche"
        >
          {retrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Relance...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Relancer
            </>
          )}
        </motion.button>
      </div>

      {result && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
        >
          <CheckCircle className="h-4 w-4" />
          {result}
        </motion.p>
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
