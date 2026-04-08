'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import ItemBuilder, { type RequestBuildItem } from '@/components/request/ItemBuilder';

interface AddRequestItemModalProps {
  open: boolean;
  requestId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddRequestItemModal({
  open,
  requestId,
  onClose,
  onCreated,
}: AddRequestItemModalProps) {
  const [items, setItems] = useState<RequestBuildItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (submitting) return;
    setItems([]);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    if (!items.length) {
      setError('Ajoutez au moins un article');
      return;
    }
    const invalidText = items.find((it) => it.type === 'text' && !it.description.trim());
    if (invalidText) {
      setError('Chaque article texte doit avoir une description');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          added_by: 'admin',
          items: items.map((it) => ({
            image_url: it.url || null,
            description: it.description.trim() || null,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      setItems([]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
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
            className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Ajouter un article à la demande
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-5">
              <ItemBuilder items={items} onChange={setItems} />
              {error && (
                <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !items.length}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Envoi...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Ajouter à la demande
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
