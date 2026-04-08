'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, CheckCircle } from 'lucide-react';

interface SearchTriggerProps {
  requestId: string;
  onSearchComplete: () => void;
}

export default function SearchTrigger({ requestId, onSearchComplete }: SearchTriggerProps) {
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/requests/${requestId}/search`, {
        method: 'POST',
      });
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
    }
  };

  return (
    <div className="space-y-3">
      <motion.button
        type="button"
        onClick={handleSearch}
        disabled={searching}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 disabled:opacity-60"
      >
        {searching ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Recherche Taobao + 1688 + traduction...
          </>
        ) : (
          <>
            <Search className="h-5 w-5" />
            Rechercher (Taobao + 1688)
          </>
        )}
      </motion.button>

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
