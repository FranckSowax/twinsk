'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ExternalLink, Minus, Info, Plus, FileText, Sparkles, CheckCircle2, User, Shield } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';
import ResultDetailModal from './ResultDetailModal';
import ManualResultModal from './ManualResultModal';

interface SearchResultRow {
  id: string;
  source: 'taobao' | '1688' | 'manual' | 'factory';
  taobao_item_id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  price: number;
  image_url: string;
  main_image_url: string | null;
  seller: string | null;
  product_url: string;
  selected: boolean;
  quantity: number;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  client_quantity: number | null;
}

interface RequestItemWithResults {
  id: string;
  image_url: string | null;
  description: string | null;
  processed: boolean;
  added_by: 'client' | 'admin';
  search_results: SearchResultRow[];
}

interface ResultsTableProps {
  items: RequestItemWithResults[];
  requestId: string;
  onUpdate: (resultId: string, fields: Partial<SearchResultRow>) => void;
  onRefresh: () => void;
}

const SOURCE_BADGE: Record<string, string> = {
  taobao: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '1688': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  manual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  factory: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const SOURCE_LABEL: Record<string, string> = {
  taobao: 'taobao',
  '1688': '1688',
  manual: 'manuel',
  factory: 'usine',
};

export default function ResultsTable({ items, requestId, onUpdate, onRefresh }: ResultsTableProps) {
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [activeResult, setActiveResult] = useState<SearchResultRow | null>(null);
  const [manualModalItemId, setManualModalItemId] = useState<string | null>(null);

  // Keep modal in sync with parent state when result is updated (e.g. selection toggle)
  const syncedActiveResult = activeResult
    ? items
        .flatMap((i) => i.search_results)
        .find((r) => r.id === activeResult.id) || null
    : null;

  const handleToggleSelect = (result: SearchResultRow) => {
    onUpdate(result.id, { selected: !result.selected });
  };

  const handleFieldChange = (resultId: string, field: keyof SearchResultRow, value: number | null) => {
    setSavingIds((prev) => new Set(prev).add(resultId));
    onUpdate(resultId, { [field]: value });
    setTimeout(() => {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(resultId);
        return next;
      });
    }, 500);
  };

  if (!items.length) {
    return <p className="text-center text-slate-500">Aucun résultat de recherche</p>;
  }

  return (
    <>
    <ResultDetailModal
      result={syncedActiveResult}
      onClose={() => setActiveResult(null)}
      onToggleSelect={handleToggleSelect}
    />
    <ManualResultModal
      open={!!manualModalItemId}
      requestId={requestId}
      requestItemId={manualModalItemId || ''}
      onClose={() => setManualModalItemId(null)}
      onCreated={onRefresh}
    />
    <div className="space-y-8">
      {items.map((item) => (
        <div key={item.id} className="space-y-4">
          {/* Client item header */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="Image client" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                  <FileText className="h-8 w-8 text-purple-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {item.image_url ? 'Article photo' : 'Article texte'}
                </p>
                {/* added_by badge */}
                {item.added_by === 'admin' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <Shield className="h-2.5 w-2.5" /> Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <User className="h-2.5 w-2.5" /> Client
                  </span>
                )}
                {/* processed badge */}
                {item.processed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Traité
                  </span>
                ) : (
                  <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    <Sparkles className="h-2.5 w-2.5" /> Nouveau
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {item.search_results.length} résultat(s) trouvé(s)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManualModalItemId(item.id)}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Produit manuel
            </button>
          </div>

          {/* Results */}
          {item.search_results.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[1400px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <th className="w-10 px-2 py-2"></th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Source</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Produit</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Prix CNY</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">MOQ</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">Poids (kg)</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">Vol (m³)</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Vendeur</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">Qté</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">Marge %</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">Prix final</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {item.search_results.map((result) => (
                    <motion.tr
                      key={result.id}
                      layout
                      onClick={(e) => {
                        // Only open modal if click is not on an interactive control
                        const target = e.target as HTMLElement;
                        if (target.closest('input, button, a')) return;
                        setActiveResult(result);
                      }}
                      className={`cursor-pointer transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/30 ${
                        result.selected
                          ? 'bg-amber-50/50 dark:bg-amber-900/10'
                          : 'bg-white dark:bg-slate-800'
                      } ${savingIds.has(result.id) ? 'opacity-70' : ''}`}
                    >
                      {/* Select */}
                      <td className="px-2 py-3">
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

                      {/* Source badge */}
                      <td className="px-2 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SOURCE_BADGE[result.source] || SOURCE_BADGE.taobao}`}>
                          {SOURCE_LABEL[result.source] || result.source}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          {result.image_url ? (
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={result.image_url}
                                alt={result.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                              <span className="text-lg">🏭</span>
                            </div>
                          )}
                          <div className="flex max-w-[220px] items-start gap-1">
                            <p
                              className="truncate text-sm font-medium text-slate-700 dark:text-slate-200"
                              title={result.title_original || result.title}
                            >
                              {result.title}
                            </p>
                            {result.description && (
                              <span title={result.description} className="flex-shrink-0">
                                <Info className="h-3.5 w-3.5 text-slate-400 hover:text-amber-500" />
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-2 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        {formatCNY(result.price)}
                      </td>

                      {/* MOQ */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min={0}
                          value={result.moq ?? ''}
                          placeholder="—"
                          onChange={(e) =>
                            handleFieldChange(
                              result.id,
                              'moq',
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Weight */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min={0}
                          step={0.001}
                          value={result.weight ?? ''}
                          placeholder="—"
                          onChange={(e) =>
                            handleFieldChange(
                              result.id,
                              'weight',
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          className="w-20 rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Volume */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min={0}
                          step={0.0001}
                          value={result.volume ?? ''}
                          placeholder="—"
                          onChange={(e) =>
                            handleFieldChange(
                              result.id,
                              'volume',
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          className="w-20 rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Seller */}
                      <td className="px-2 py-3 max-w-[140px] truncate text-sm text-slate-500" title={result.seller || ''}>
                        {result.seller || '—'}
                      </td>

                      {/* Quantity */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min={1}
                          value={result.quantity}
                          onChange={(e) =>
                            handleFieldChange(
                              result.id,
                              'quantity',
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Margin */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={result.margin_percent}
                          onChange={(e) =>
                            handleFieldChange(
                              result.id,
                              'margin_percent',
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Final price */}
                      <td className="px-2 py-3 text-right text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatCNY(applyMargin(result.price, result.margin_percent) * result.quantity)}
                      </td>

                      {/* Link */}
                      <td className="px-2 py-3">
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
    </>
  );
}
