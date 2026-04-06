'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Package } from 'lucide-react';

export default function SubmitConfirmation() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 p-12 text-center dark:from-green-900/20 dark:to-emerald-900/20"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
      >
        <CheckCircle className="h-20 w-20 text-green-500" />
      </motion.div>

      <div>
        <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
          Demande envoyée avec succès !
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Notre équipe va analyser vos images et rechercher les meilleurs produits correspondants.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-white px-6 py-4 dark:border-green-800 dark:bg-slate-800">
        <Package className="h-5 w-5 text-amber-500" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Vous recevrez un devis détaillé par email dans les plus brefs délais.
        </p>
      </div>
    </motion.div>
  );
}
