'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Plus, Send, X } from 'lucide-react';
import ItemBuilder, { type RequestBuildItem } from './ItemBuilder';

interface SubmitConfirmationProps {
  requestId: string;
}

export default function SubmitConfirmation({ requestId }: SubmitConfirmationProps) {
  const [showAddMore, setShowAddMore] = useState(false);
  const [extraItems, setExtraItems] = useState<RequestBuildItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [error, setError] = useState('');

  const handleSubmitMore = async () => {
    setError('');
    if (!extraItems.length) {
      setError('Ajoutez au moins un article');
      return;
    }
    const invalidText = extraItems.find((it) => it.type === 'text' && !it.description.trim());
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
          items: extraItems.map((it) => ({
            image_url: it.url || null,
            description: it.description.trim() || null,
          })),
        }),
      });
      if (!res.ok) throw new Error('Erreur envoi');
      setAddedCount((c) => c + extraItems.length);
      setExtraItems([]);
      setShowAddMore(false);
    } catch {
      setError('Une erreur est survenue. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center sm:p-12 dark:from-green-900/20 dark:to-emerald-900/20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
        >
          <CheckCircle className="h-16 w-16 text-green-500 sm:h-20 sm:w-20" />
        </motion.div>

        <div>
          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
            Demande envoyée avec succès !
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Notre équipe va analyser vos articles et rechercher les meilleurs produits correspondants.
          </p>
          {addedCount > 0 && (
            <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">
              ✓ {addedCount} article(s) supplémentaire(s) ajouté(s)
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-white px-6 py-4 dark:border-green-800 dark:bg-slate-800">
          <Package className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Vous recevrez un devis détaillé par email dans les plus brefs délais.
          </p>
        </div>
      </motion.div>

      {/* Add more items section */}
      {!showAddMore ? (
        <motion.button
          type="button"
          onClick={() => setShowAddMore(true)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 px-6 py-4 font-medium text-amber-700 hover:border-amber-500 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-900/10 dark:text-amber-400"
        >
          <Plus className="h-5 w-5" />
          Ajouter d&apos;autres articles à ma demande
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Articles supplémentaires
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowAddMore(false);
                setExtraItems([]);
                setError('');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ItemBuilder items={extraItems} onChange={setExtraItems} />

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <motion.button
            type="button"
            onClick={handleSubmitMore}
            disabled={submitting || !extraItems.length}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Envoyer ces articles
              </>
            )}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
