'use client';

import { motion } from 'framer-motion';
import { FileText, Package } from 'lucide-react';
import type { DocumentType } from '@/lib/types/database';

interface DocumentTypeSelectorProps {
  value: DocumentType;
  onChange: (value: DocumentType) => void;
}

export default function DocumentTypeSelector({ value, onChange }: DocumentTypeSelectorProps) {
  const options: { value: DocumentType; label: string; icon: typeof FileText; description: string }[] = [
    {
      value: 'devis',
      label: 'Devis',
      icon: FileText,
      description: 'Avec prix et marges',
    },
    {
      value: 'packing_list',
      label: 'Packing list',
      icon: Package,
      description: 'Logistique uniquement',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">
        Type de document à générer
      </p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <motion.button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                active
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-slate-200 hover:border-amber-300 dark:border-slate-600 dark:hover:border-amber-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
