'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';

export type ProposalCurrency = 'CNY' | 'USD' | 'EUR' | 'XAF';

interface Option {
  code: ProposalCurrency;
  label: string;
  flag: string;
  hint: string;
  color: string;
}

const OPTIONS: Option[] = [
  { code: 'CNY', label: 'Yuan chinois', flag: '🇨🇳', hint: 'Prix d\'achat brut', color: 'amber' },
  { code: 'USD', label: 'Dollar US', flag: '🇺🇸', hint: 'International', color: 'blue' },
  { code: 'EUR', label: 'Euro', flag: '🇪🇺', hint: 'Europe', color: 'indigo' },
  { code: 'XAF', label: 'Franc CFA', flag: '🇨🇲', hint: 'Afrique centrale (par défaut)', color: 'emerald' },
];

interface ProposalCurrencyModalProps {
  open: boolean;
  requestId: string;
  currentCurrency: ProposalCurrency;
  onClose: () => void;
  onSaved: (currency: ProposalCurrency) => void;
}

export default function ProposalCurrencyModal({
  open,
  requestId,
  currentCurrency,
  onClose,
  onSaved,
}: ProposalCurrencyModalProps) {
  const [selected, setSelected] = useState<ProposalCurrency>(currentCurrency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_currency: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur sauvegarde');
      }
      onSaved(selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
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
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Devise affichée au client
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sélectionnez la devise principale ; les autres seront affichées en
                  conversion (≈) sur la page proposition.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-6">
              {OPTIONS.map((opt) => {
                const isActive = opt.code === selected;
                const colorClasses: Record<string, string> = {
                  amber: isActive ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200 dark:bg-amber-900/20' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50',
                  blue: isActive ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-900/20' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50',
                  indigo: isActive ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 dark:bg-indigo-900/20' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50',
                  emerald: isActive ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-900/20' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50',
                };
                const checkColor: Record<string, string> = {
                  amber: 'text-amber-600',
                  blue: 'text-blue-600',
                  indigo: 'text-indigo-600',
                  emerald: 'text-emerald-600',
                };
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setSelected(opt.code)}
                    className={`relative rounded-2xl border-2 bg-white p-4 text-left transition-all dark:bg-slate-700 ${colorClasses[opt.color]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{opt.flag}</span>
                        <div>
                          <p className="font-display text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                            {opt.code}
                          </p>
                          <p className="text-xs text-slate-500">{opt.label}</p>
                        </div>
                      </div>
                      {isActive && (
                        <Check className={`h-5 w-5 flex-shrink-0 ${checkColor[opt.color]}`} />
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">{opt.hint}</p>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="mx-6 mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Enregistrer
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
