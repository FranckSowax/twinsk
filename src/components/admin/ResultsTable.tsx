'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ExternalLink, Minus, Info, Plus, FileText, Sparkles, CheckCircle2, User, Shield, X, Pencil, Trash2 } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import ResultDetailModal from './ResultDetailModal';
import ManualResultModal from './ManualResultModal';
import EditRequestItemModal from './EditRequestItemModal';
import NotesThread, { type NoteItem } from '@/components/ui/NotesThread';

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
  extra_images: string[] | null;
  variants: {
    id: string;
    name: string;
    price?: number | null;
    moq?: number | null;
    weight?: number | null;
    volume?: number | null;
    dimensions?: string | null;
    capacity?: string | null;
  }[] | null;
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
  client_selected: boolean | null;
  client_variant_id: string | null;
}

interface RequestItemWithResults {
  id: string;
  image_url: string | null;
  description: string | null;
  processed: boolean;
  added_by: 'client' | 'admin';
  search_results: SearchResultRow[];
  item_notes?: NoteItem[];
}

interface ResultsTableProps {
  items: RequestItemWithResults[];
  requestId: string;
  basePath?: string;
  manualCreateSuffix?: string;
  manualUpdateSuffix?: string;
  hideClientFeedback?: boolean;
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

export default function ResultsTable({
  items,
  requestId,
  basePath = '/api/requests',
  manualCreateSuffix = 'manual-result',
  manualUpdateSuffix = 'results',
  hideClientFeedback = false,
  onUpdate,
  onRefresh,
}: ResultsTableProps) {
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [activeResult, setActiveResult] = useState<SearchResultRow | null>(null);
  const [manualModalItemId, setManualModalItemId] = useState<string | null>(null);
  const [editingResult, setEditingResult] = useState<
    { requestItemId: string; result: SearchResultRow } | null
  >(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<RequestItemWithResults | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDeleteItem = async (item: RequestItemWithResults) => {
    const label = item.description || (item.image_url ? 'Article photo' : 'Article');
    const resultCount = item.search_results.length;
    const warn = resultCount
      ? `Supprimer "${label}" et ses ${resultCount} résultat(s) ? Cette action est irréversible.`
      : `Supprimer "${label}" ? Cette action est irréversible.`;
    if (!window.confirm(warn)) return;

    setDeletingIds((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch(`${basePath}/${requestId}/items/${item.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Erreur suppression');
        return;
      }
      onRefresh();
    } catch {
      alert('Erreur réseau');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

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
      open={!!manualModalItemId || !!editingResult}
      requestId={requestId}
      basePath={basePath}
      createPathSuffix={manualCreateSuffix}
      updatePathSuffix={manualUpdateSuffix}
      requestItemId={editingResult?.requestItemId || manualModalItemId || ''}
      existingResult={
        editingResult
          ? {
              id: editingResult.result.id,
              title: editingResult.result.title,
              description: editingResult.result.description,
              price: editingResult.result.price,
              image_url: editingResult.result.image_url,
              main_image_url: editingResult.result.main_image_url,
              extra_images: editingResult.result.extra_images,
              seller: editingResult.result.seller,
              product_url: editingResult.result.product_url,
              moq: editingResult.result.moq,
              weight: editingResult.result.weight,
              volume: editingResult.result.volume,
              dimensions: editingResult.result.dimensions,
              quantity: editingResult.result.quantity,
              variants: editingResult.result.variants,
            }
          : null
      }
      onClose={() => {
        setManualModalItemId(null);
        setEditingResult(null);
      }}
      onCreated={onRefresh}
    />
    <EditRequestItemModal
      open={!!editItem}
      requestId={requestId}
      basePath={basePath}
      item={
        editItem
          ? {
              id: editItem.id,
              image_url: editItem.image_url,
              description: editItem.description,
            }
          : null
      }
      onClose={() => setEditItem(null)}
      onSaved={onRefresh}
    />
    {/* Zoom lightbox for client photos */}
    <AnimatePresence>
      {zoomImageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setZoomImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="relative max-h-[90vh] max-w-[90vw]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proxyImageUrl(zoomImageUrl)} alt="Zoom" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" />
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <div className="space-y-8">
      {items.map((item) => (
        <div key={item.id} className="space-y-4">
          {/* Client item header */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div
              className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl ${item.image_url ? 'cursor-zoom-in' : ''}`}
              onClick={() => item.image_url && setZoomImageUrl(item.image_url)}
            >
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proxyImageUrl(item.image_url)} alt="Image client" className="h-full w-full object-cover" />
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
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setManualModalItemId(item.id)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Produit manuel
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditItem(item)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  title="Modifier l'article"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={deletingIds.has(item.id)}
                  onClick={() => handleDeleteItem(item)}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-400"
                  title="Supprimer l'article"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingIds.has(item.id) ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
              <NotesThread
                notes={item.item_notes || []}
                requestItemId={item.id}
                currentUser="admin"
                onNoteAdded={onRefresh}
              />
            </div>
          </div>

          {/* Results — split into products vs factories */}
          {(() => {
            const products = item.search_results.filter((r) => r.source !== 'factory');
            const factories = item.search_results.filter((r) => r.source === 'factory');
            return item.search_results.length > 0 ? (
              <div className="space-y-4">
              {/* Products table */}
              {products.length > 0 && (
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
                  {products.map((result) => (
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
                        result.client_selected === true
                          ? 'bg-green-50/70 dark:bg-green-900/15'
                          : result.selected
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

                      {/* Source badge + client status */}
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SOURCE_BADGE[result.source] || SOURCE_BADGE.taobao}`}>
                            {SOURCE_LABEL[result.source] || result.source}
                          </span>
                          {result.client_selected === true && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              <Check className="h-2.5 w-2.5" /> Client
                            </span>
                          )}
                          {result.client_selected === false && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                              <X className="h-2.5 w-2.5" /> Refusé
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Product */}
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          {result.image_url ? (
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={proxyImageUrl(result.image_url)}
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

                      {/* Actions */}
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {result.source === 'manual' && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingResult({ requestItemId: item.id, result })
                              }
                              className="text-slate-400 hover:text-amber-500"
                              title="Modifier ce produit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {result.product_url && (
                            <a
                              href={result.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-amber-500"
                              title="Ouvrir l'URL du produit"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
              )}

              {/* Factories section */}
              {factories.length > 0 && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-800 dark:bg-purple-900/10">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    <span>🏭</span> Usines recommandées ({factories.length})
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {factories.map((result) => {
                      const isSelected = result.selected;
                      return (
                        <div
                          key={result.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button')) return;
                            setActiveResult(result);
                          }}
                          className={`cursor-pointer rounded-xl border-2 p-3 transition-all hover:shadow-md ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-slate-200 bg-white hover:border-purple-300 dark:border-slate-600 dark:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white" title={result.title}>
                                {result.title}
                              </p>
                              {result.seller && (
                                <p className="mt-0.5 text-xs text-slate-500">{result.seller}</p>
                              )}
                              {result.moq != null && (
                                <p className="mt-1 text-[10px] text-slate-400">MOQ: {result.moq}</p>
                              )}
                              {result.price > 0 && (
                                <p className="mt-1 text-xs font-medium text-amber-600">{formatCNY(result.price)}/u</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(result)}
                              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500 text-white'
                                  : 'border-slate-300 hover:border-purple-400 dark:border-slate-600'
                              }`}
                            >
                              {isSelected ? <Check className="h-4 w-4" /> : <Minus className="h-3 w-3 text-transparent" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            ) : (
            <p className="pl-4 text-sm text-slate-400">Aucun résultat pour cette image</p>
          );
          })()}
        </div>
      ))}
    </div>
    </>
  );
}
