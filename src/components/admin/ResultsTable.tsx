'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ExternalLink, Minus } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';

interface SearchResultRow {
  id: string;
  taobao_item_id: string;
  title: string;
  price: number;
  image_url: string;
  seller: string | null;
  product_url: string;
  selected: boolean;
  quantity: number;
  margin_percent: number;
}

interface RequestItemWithResults {
  id: string;
  image_url: string;
  description: string | null;
  search_results: SearchResultRow[];
}

interface ResultsTableProps {
  items: RequestItemWithResults[];
  onUpdate: (resultId: string, fields: Partial<SearchResultRow>) => void;
}

export default function ResultsTable({ items, onUpdate }: ResultsTableProps) {
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = (result: SearchResultRow) => {
    onUpdate(result.id, { selected: !result.selected });
  };

  const handleFieldChange = async (resultId: string, field: string, value: number) => {
    setSavingIds((prev) => new Set(prev).add(resultId));
    onUpdate(resultId, { [field]: value });
    // Debounce visual feedback
    setTimeout(() => {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(resultId);
        return next;
      });
    }, 500);
  };

  if (!items.length) {
    return (
      <p className="text-center text-slate-500">Aucun résultat de recherche</p>
    );
  }

  return (
    <div className="space-y-8">
      {items.map((item) => (
        <div key={item.id} className="space-y-4">
          {/* Client image header */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl">
              <img
                src={item.image_url}
                alt="Image client"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Image du client
              </p>
              {item.description && (
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {item.search_results.length} résultat(s) trouvé(s)
              </p>
            </div>
          </div>

          {/* Results */}
          {item.search_results.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Produit</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Prix CNY</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Vendeur</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">Qté</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">Marge %</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Prix final</th>
                    <th className="w-10 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {item.search_results.map((result) => (
                    <motion.tr
                      key={result.id}
                      layout
                      className={`transition-colors ${
                        result.selected
                          ? 'bg-amber-50/50 dark:bg-amber-900/10'
                          : 'bg-white dark:bg-slate-800'
                      } ${savingIds.has(result.id) ? 'opacity-70' : ''}`}
                    >
                      {/* Select checkbox */}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(result)}
                          className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-colors ${
                            result.selected
                              ? 'border-amber-500 bg-amber-500 text-white'
                              : 'border-slate-300 hover:border-amber-400 dark:border-slate-600'
                          }`}
                        >
                          {result.selected ? <Check className="h-4 w-4" /> : <Minus className="h-3 w-3 text-transparent" />}
                        </button>
                      </td>

                      {/* Product */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                            <img
                              src={result.image_url}
                              alt={result.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <p className="max-w-[200px] truncate text-sm font-medium text-slate-700 dark:text-slate-200" title={result.title}>
                            {result.title}
                          </p>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        {formatCNY(result.price)}
                      </td>

                      {/* Seller */}
                      <td className="px-3 py-3 text-sm text-slate-500">
                        {result.seller || '—'}
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={1}
                          value={result.quantity}
                          onChange={(e) => handleFieldChange(result.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Margin */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={result.margin_percent}
                          onChange={(e) => handleFieldChange(result.id, 'margin_percent', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Final price */}
                      <td className="px-3 py-3 text-right text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatCNY(applyMargin(result.price, result.margin_percent) * result.quantity)}
                      </td>

                      {/* Link */}
                      <td className="px-3 py-3">
                        <a
                          href={result.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-amber-500"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pl-4 text-sm text-slate-400">Aucun résultat pour cette image</p>
          )}
        </div>
      ))}
    </div>
  );
}
