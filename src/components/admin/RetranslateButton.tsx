'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Languages, Loader2, CheckCircle, Square } from 'lucide-react';

interface RetranslateButtonProps {
  requestId: string;
  onComplete: () => void;
}

export default function RetranslateButton({ requestId, onComplete }: RetranslateButtonProps) {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const cancelRef = useRef(false);

  const runLoop = useCallback(async () => {
    setRunning(true);
    setError('');
    setMessage('');
    cancelRef.current = false;

    let loopDone = 0;
    let loopTotal = 0;

    while (!cancelRef.current) {
      try {
        const res = await fetch(`/api/requests/${requestId}/translate`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Erreur traduction');
          break;
        }

        loopTotal = data.total || 0;
        const remaining = data.remaining ?? 0;
        loopDone = loopTotal - remaining;

        setTotal(loopTotal);
        setDone(loopDone);
        setMessage(data.message || '');
        onComplete();

        // Stop if nothing left or if updated=0 (Kimi is stuck)
        if (remaining <= 0 || data.updated === 0) break;
      } catch {
        setError('Erreur réseau');
        break;
      }
    }

    setRunning(false);
  }, [requestId, onComplete]);

  const handleStop = () => {
    cancelRef.current = true;
  };

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-2">
      {!running ? (
        <motion.button
          type="button"
          onClick={runLoop}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/25"
        >
          <Languages className="h-5 w-5" />
          Retraduire en FR
        </motion.button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-900/10">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Traduction en cours... {done}/{total}
            </p>
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <Square className="h-3 w-3" /> Arrêter
            </button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-purple-200 dark:bg-purple-900/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400">{pct}%</p>
        </div>
      )}

      {!running && message && (
        <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" /> {message}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
