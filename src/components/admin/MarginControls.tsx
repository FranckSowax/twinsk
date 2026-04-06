'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Percent } from 'lucide-react';

interface MarginControlsProps {
  onApplyGlobal: (margin: number) => void;
}

export default function MarginControls({ onApplyGlobal }: MarginControlsProps) {
  const [globalMargin, setGlobalMargin] = useState(30);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <Percent className="h-5 w-5 text-amber-500" />
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Marge globale :
        </label>
        <input
          type="number"
          min={0}
          step={5}
          value={globalMargin}
          onChange={(e) => setGlobalMargin(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-sm font-medium dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
        <span className="text-sm text-slate-500">%</span>
      </div>
      <motion.button
        type="button"
        onClick={() => onApplyGlobal(globalMargin)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm"
      >
        Appliquer à tous
      </motion.button>
    </div>
  );
}
