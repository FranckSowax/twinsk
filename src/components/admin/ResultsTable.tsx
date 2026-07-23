'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ExternalLink, Minus, Info, Plus, FileText, Sparkles, CheckCircle2, User, Shield, X, Pencil, Trash2, GripVertical, Send, ChevronDown, ChevronRight, Video } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import ResultDetailModal from './ResultDetailModal';
import ManualResultModal from './ManualResultModal';
import EditRequestItemModal from './EditRequestItemModal';
import NotesThread, { type NoteItem } from '@/components/ui/NotesThread';
import { useAdminT } from '@/components/admin/LocaleProvider';
import type { TKey } from '@/lib/i18n/admin';

interface SearchResultRow {
  id: string;
  source: 'taobao' | '1688' | 'manual' | 'factory';
  taobao_item_id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  price: number | null; // null = prix à confirmer (produit à paliers ou collecte incomplète)
  image_url: string;
  main_image_url: string | null;
  extra_images: string[] | null;
  videos: string[] | null;
  has_battery: boolean | null;
  info_manquante: string | null;
  dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
  variants: {
    id: string;
    name: string;
    image_url?: string | null;
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
  // Métriques de fiabilité fournisseur (classement) — null si inconnu
  repurchase_rate?: number | null;
  sales?: number | null;
  star_rate?: number | null;
  // Champs INTERNES (jamais exposés au client)
  supplier_shipping_price?: number | null;
  delivery_time?: string | null;
  description_admin?: string | null; // description interne (notes/specs)
  // Révision collaborateur : 'reviewed' = révisée, en attente de validation admin (ligne bleue).
  review_state?: string | null;
  // Ordre manuel dans la catégorie (null = tri par fiabilité).
  position?: number | null;
  // « Vu dans la vidéo » : présent dans la vidéo de cover → badge rose fluo côté client.
  in_cover_video?: boolean | null;
}

interface RequestItemWithResults {
  id: string;
  image_url: string | null;
  description: string | null;
  processed: boolean;
  added_by: 'client' | 'admin';
  phase_id?: string | null; // phase de la catégorie (offres B2B)
  search_results: SearchResultRow[];
  item_notes?: NoteItem[];
}

interface OfferPhase {
  id: string;
  title: string;
}

interface ResultsTableProps {
  items: RequestItemWithResults[];
  requestId: string;
  basePath?: string;
  manualCreateSuffix?: string;
  manualUpdateSuffix?: string;
  hideClientFeedback?: boolean;
  /** Si fournie, active le drag & drop des lignes entre categories. */
  onMoveResult?: (productId: string, fromItemId: string, toItemId: string) => Promise<void>;
  onUpdate: (resultId: string, fields: Partial<SearchResultRow>) => void;
  onRefresh: () => void;
  /** Si fournie (contexte offre, admin), affiche le bouton « Envoyer aux collaborateurs » par ligne. */
  onSendToCollab?: (result: SearchResultRow) => void | Promise<void>;
  /** Ids déjà envoyés (pour l'affichage « Envoyée ✓»). */
  sentCollabIds?: Set<string>;
  /** Si fournie (contexte offre, admin), affiche « Valider » sur les lignes révisées (bleues). */
  onValidateReview?: (result: SearchResultRow) => void | Promise<void>;
  /** Si fournie, active le glisser-déposer pour réordonner les catégories (blocs). */
  onReorderCategories?: (orderedItemIds: string[]) => void | Promise<void>;
  /** Phases de l'offre (B2B) : affiche des bannières de phase + un sélecteur par catégorie. */
  phases?: OfferPhase[];
  /** Change la phase d'une catégorie. */
  onSetItemPhase?: (itemId: string, phaseId: string | null) => void | Promise<void>;
  /** Si fournie, active le glisser-déposer pour réordonner les produits DANS une catégorie. */
  onReorderProducts?: (itemId: string, orderedProductIds: string[]) => void | Promise<void>;
  /** Si fournie, affiche un bouton pour supprimer un produit de sa catégorie. */
  onDeleteResult?: (result: SearchResultRow) => void | Promise<void>;
}

const SOURCE_BADGE: Record<string, string> = {
  taobao: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '1688': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  manual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  factory: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// Score de fiabilité fournisseur : réachat > ventes > note (valeurs inconnues reléguées).
function trustScore(r: Pick<SearchResultRow, 'repurchase_rate' | 'sales' | 'star_rate'>): number {
  const rate = r.repurchase_rate ?? -1;
  const sales = r.sales ?? -1;
  const star = r.star_rate ?? -1;
  return rate * 1_000_000 + Math.log10(sales + 1) * 1000 + star;
}

// Formate un volume de ventes : 1234 → "1,2k", 12000 → "12k"
function formatSales(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k`;
  return String(n);
}

// True si le résultat porte au moins une métrique de fiabilité exploitable.
function hasTrust(r: SearchResultRow): boolean {
  return r.repurchase_rate != null || r.sales != null || r.star_rate != null;
}

export default function ResultsTable({
  items,
  requestId,
  basePath = '/api/requests',
  manualCreateSuffix = 'manual-result',
  manualUpdateSuffix = 'results',
  hideClientFeedback = false,
  onMoveResult,
  onUpdate,
  onRefresh,
  onSendToCollab,
  sentCollabIds,
  onValidateReview,
  onReorderCategories,
  phases,
  onSetItemPhase,
  onReorderProducts,
  onDeleteResult,
}: ResultsTableProps) {
  const { t } = useAdminT();
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [activeResult, setActiveResult] = useState<SearchResultRow | null>(null);
  const [manualModalItemId, setManualModalItemId] = useState<string | null>(null);
  const [editingResult, setEditingResult] = useState<
    { requestItemId: string; result: SearchResultRow } | null
  >(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<RequestItemWithResults | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [draggingResultId, setDraggingResultId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const dragEnabled = !!onMoveResult;
  const productReorderEnabled = !!onReorderProducts;
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);

  // Réordonne un produit DANS sa catégorie (drop sur une autre ligne de la même catégorie).
  const handleReorderProduct = (
    itemId: string,
    orderedIds: string[],
    draggedId: string,
    targetId: string,
  ) => {
    if (!onReorderProducts || draggedId === targetId) return;
    const from = orderedIds.indexOf(draggedId);
    const to = orderedIds.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...orderedIds];
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    onReorderProducts(itemId, next);
  };
  // Réordonnancement des catégories (blocs)
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const categoryDragEnabled = !!onReorderCategories;
  // Repli des catégories (produits masqués) — facilite le glisser-déposer.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (itemId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  const collapseAll = () => setCollapsed(new Set(items.map((it) => it.id)));
  const expandAll = () => setCollapsed(new Set());

  const handleReorderCategory = (targetItemId: string, draggedItemId: string) => {
    if (!onReorderCategories || targetItemId === draggedItemId) return;
    const ids = items.map((it) => it.id);
    const from = ids.indexOf(draggedItemId);
    const to = ids.indexOf(targetItemId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedItemId);
    onReorderCategories(ids);
  };

  const handleDropOnItem = async (toItemId: string, fromItemId: string, productId: string) => {
    if (!onMoveResult || toItemId === fromItemId) {
      setDraggingResultId(null);
      setDragOverItemId(null);
      return;
    }
    setMovingIds((prev) => new Set(prev).add(productId));
    try {
      await onMoveResult(productId, fromItemId, toItemId);
    } finally {
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setDraggingResultId(null);
      setDragOverItemId(null);
    }
  };

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

  const handleStringFieldChange = (resultId: string, field: keyof SearchResultRow, value: string | null) => {
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
    return <p className="text-center text-slate-500">{t('table.noResults')}</p>;
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
              supplier_shipping_price: editingResult.result.supplier_shipping_price ?? null,
              delivery_time: editingResult.result.delivery_time ?? null,
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
      {items.length > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={collapseAll}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            title="Replier toutes les catégories (facilite le glisser-déposer)"
          >
            <ChevronRight className="h-3.5 w-3.5" /> Tout replier
          </button>
          <button
            type="button"
            onClick={expandAll}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
          >
            <ChevronDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
        </div>
      )}
      {items.map((item, itemIdx) => {
        const showPhaseHeader =
          !!phases &&
          phases.length > 0 &&
          (itemIdx === 0 || items[itemIdx - 1].phase_id !== item.phase_id);
        const phaseTitle = item.phase_id
          ? phases?.find((p) => p.id === item.phase_id)?.title || 'Phase'
          : 'Sans phase';
        return (
        <div key={item.id} className="space-y-4">
          {showPhaseHeader && (
            <div className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 ${item.phase_id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              <span className="text-sm font-bold uppercase tracking-wide">🏗️ {phaseTitle}</span>
            </div>
          )}
        <div
          key={item.id}
          className={`space-y-4 rounded-3xl transition-all ${
            dragEnabled && dragOverItemId === item.id && draggingResultId
              ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
              : ''
          } ${
            categoryDragEnabled && dragOverCategoryId === item.id && draggingCategoryId && draggingCategoryId !== item.id
              ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
              : ''
          } ${draggingCategoryId === item.id ? 'opacity-50' : ''}`}
          onDragOver={(e) => {
            if (dragEnabled && draggingResultId) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverItemId !== item.id) setDragOverItemId(item.id);
              return;
            }
            if (categoryDragEnabled && draggingCategoryId) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverCategoryId !== item.id) setDragOverCategoryId(item.id);
            }
          }}
          onDragLeave={(e) => {
            if (!dragEnabled && !categoryDragEnabled) return;
            // ne nettoie que si on quitte vraiment le conteneur
            const next = e.relatedTarget as Node | null;
            if (next && (e.currentTarget as HTMLElement).contains(next)) return;
            if (dragOverItemId === item.id) setDragOverItemId(null);
            if (dragOverCategoryId === item.id) setDragOverCategoryId(null);
          }}
          onDrop={(e) => {
            // Réordonnancement de catégorie
            if (categoryDragEnabled) {
              const cat = e.dataTransfer.getData('application/x-twinsk-category');
              if (cat) {
                e.preventDefault();
                handleReorderCategory(item.id, cat);
                setDraggingCategoryId(null);
                setDragOverCategoryId(null);
                return;
              }
            }
            // Déplacement de produit entre catégories
            if (!dragEnabled) return;
            e.preventDefault();
            const payload = e.dataTransfer.getData('application/x-twinsk-product');
            if (!payload) return;
            try {
              const { productId, fromItemId } = JSON.parse(payload) as {
                productId: string;
                fromItemId: string;
              };
              if (productId && fromItemId) {
                handleDropOnItem(item.id, fromItemId, productId);
              }
            } catch {
              // ignore
            }
          }}
        >
          {/* Client item header */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            {categoryDragEnabled && (
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-twinsk-category', item.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingCategoryId(item.id);
                }}
                onDragEnd={() => {
                  setDraggingCategoryId(null);
                  setDragOverCategoryId(null);
                }}
                title="Glisser pour réordonner la catégorie"
                className="flex h-10 w-6 flex-shrink-0 cursor-grab items-center justify-center rounded-md text-slate-300 hover:bg-slate-200 hover:text-slate-500 active:cursor-grabbing dark:hover:bg-slate-700"
              >
                <GripVertical className="h-5 w-5" />
              </div>
            )}
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
                  {item.image_url ? t('item.photo') : t('item.text')}
                </p>
                {/* added_by badge */}
                {item.added_by === 'admin' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <Shield className="h-2.5 w-2.5" /> {t('badge.admin')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <User className="h-2.5 w-2.5" /> {t('badge.client')}
                  </span>
                )}
                {/* processed badge */}
                {item.processed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle2 className="h-2.5 w-2.5" /> {t('badge.processed')}
                  </span>
                ) : (
                  <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    <Sparkles className="h-2.5 w-2.5" /> {t('badge.new')}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              )}
              {phases && phases.length > 0 && onSetItemPhase && (
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  🏗️ Phase :
                  <select
                    value={item.phase_id || ''}
                    onChange={(e) => onSetItemPhase(item.id, e.target.value || null)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Sans phase</option>
                    {phases.map((ph) => (
                      <option key={ph.id} value={ph.id}>{ph.title}</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={() => toggleCollapse(item.id)}
                className="mt-1 flex items-center gap-1 rounded text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={collapsed.has(item.id) ? 'Déplier les produits' : 'Replier les produits'}
              >
                {collapsed.has(item.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {item.search_results.length} {t('item.resultsFound')}
                {collapsed.has(item.id) && item.search_results.length > 0 && (
                  <span className="text-slate-300">· repliés</span>
                )}
              </button>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setManualModalItemId(item.id)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('action.manualProduct')}
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditItem(item)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  title="Modifier l'article"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t('action.edit')}
                </button>
                <button
                  type="button"
                  disabled={deletingIds.has(item.id)}
                  onClick={() => handleDeleteItem(item)}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-400"
                  title="Supprimer l'article"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingIds.has(item.id) ? t('action.deleting') : t('action.delete')}
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

          {/* Results — split into products vs factories (masqués si catégorie repliée) */}
          {!collapsed.has(item.id) && (() => {
            const products = item.search_results
              .filter((r) => r.source !== 'factory')
              // Ordre manuel (position) prioritaire ; à défaut, tri par fiabilité fournisseur.
              .sort((a, b) => {
                const pa = a.position, pb = b.position;
                if (pa != null && pb != null) return pa - pb;
                if (pa != null) return -1;
                if (pb != null) return 1;
                return trustScore(b) - trustScore(a);
              });
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
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">{t('col.source')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">{t('col.product')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">{t('col.priceCny')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">{t('col.moq')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">{t('col.weight')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">{t('col.volume')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">{t('col.dimensions')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">{t('col.seller')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">{t('col.reliability')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">{t('col.qty')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">{t('col.margin')}</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-500">{t('col.finalPrice')}</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {products.map((result) => (
                    <motion.tr
                      key={result.id}
                      layout
                      data-flip-id={`product-${result.id}`}
                      draggable={dragEnabled || productReorderEnabled}
                      onDragStart={(e) => {
                        if (!dragEnabled && !productReorderEnabled) return;
                        const dt = (e as unknown as React.DragEvent).dataTransfer;
                        dt.setData(
                          'application/x-twinsk-product',
                          JSON.stringify({ productId: result.id, fromItemId: item.id }),
                        );
                        dt.effectAllowed = 'move';
                        setDraggingResultId(result.id);
                      }}
                      onDragOver={(e) => {
                        // Réordonnancement intra-catégorie : survol d'une autre ligne.
                        if (!productReorderEnabled || !draggingResultId || draggingResultId === result.id) return;
                        // Uniquement si le produit tiré vient de CETTE catégorie ;
                        // sinon on laisse le conteneur gérer le déplacement inter-catégories.
                        const sameCat = item.search_results.some((r) => r.id === draggingResultId);
                        if (!sameCat) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverProductId !== result.id) setDragOverProductId(result.id);
                      }}
                      onDrop={(e) => {
                        if (!productReorderEnabled) return;
                        const payload = e.dataTransfer.getData('application/x-twinsk-product');
                        if (!payload) return;
                        let parsed: { productId?: string; fromItemId?: string } = {};
                        try { parsed = JSON.parse(payload); } catch { return; }
                        // Uniquement si le produit vient de LA MÊME catégorie → réordonner.
                        if (parsed.fromItemId === item.id && parsed.productId) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReorderProduct(item.id, products.map((p) => p.id), parsed.productId, result.id);
                        }
                        setDragOverProductId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingResultId(null);
                        setDragOverItemId(null);
                        setDragOverProductId(null);
                      }}
                      onClick={(e) => {
                        // Only open modal if click is not on an interactive control
                        const target = e.target as HTMLElement;
                        if (target.closest('input, button, a')) return;
                        setActiveResult(result);
                      }}
                      className={`cursor-pointer transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/30 ${
                        result.review_state === 'reviewed'
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : result.client_selected === true
                            ? 'bg-green-50/70 dark:bg-green-900/15'
                            : result.selected
                              ? 'bg-amber-50/50 dark:bg-amber-900/10'
                              : 'bg-white dark:bg-slate-800'
                      } ${savingIds.has(result.id) ? 'opacity-70' : ''} ${
                        draggingResultId === result.id ? 'opacity-40' : ''
                      } ${movingIds.has(result.id) ? 'opacity-50' : ''} ${
                        dragOverProductId === result.id ? 'ring-2 ring-inset ring-indigo-400' : ''
                      }`}
                    >
                      {/* Select */}
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1.5">
                          {dragEnabled && (
                            <span
                              title="Glisser pour déplacer vers une autre catégorie"
                              className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400"
                            >
                              <GripVertical className="h-4 w-4" />
                            </span>
                          )}
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
                        </div>
                      </td>

                      {/* Source badge + client status */}
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SOURCE_BADGE[result.source] || SOURCE_BADGE.taobao}`}>
                            {t(('source.' + result.source) as TKey)}
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
                        {result.price == null ? (
                          <span className="text-amber-600">{t('table.priceToConfirm')}</span>
                        ) : (
                          formatCNY(result.price)
                        )}
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

                      {/* Dimensions */}
                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={result.dimensions ?? ''}
                          placeholder="L×l×h cm"
                          onChange={(e) =>
                            handleStringFieldChange(
                              result.id,
                              'dimensions',
                              e.target.value || null
                            )
                          }
                          className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Seller */}
                      <td className="px-2 py-3 max-w-[140px] truncate text-sm text-slate-500" title={result.seller || ''}>
                        {result.seller || '—'}
                      </td>

                      {/* Fiabilité fournisseur */}
                      <td className="px-2 py-3 whitespace-nowrap">
                        {hasTrust(result) ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {result.repurchase_rate != null && (
                              <span
                                title="Taux de réachat (回头率) — fidélité des acheteurs"
                                className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              >
                                {Math.round(result.repurchase_rate)}% {t('table.repurchase')}
                              </span>
                            )}
                            {result.sales != null && result.sales > 0 && (
                              <span
                                title="Volume de ventes"
                                className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                              >
                                {formatSales(result.sales)} {t('table.sales')}
                              </span>
                            )}
                            {result.star_rate != null && result.star_rate > 0 && (
                              <span
                                title="Note moyenne boutique"
                                className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              >
                                ★ {result.star_rate.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
                        {result.price == null
                          ? '—'
                          : formatCNY(applyMargin(result.price, result.margin_percent) * result.quantity)}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* « Vu dans la vidéo » — toggle (badge rose fluo côté client) */}
                          <button
                            type="button"
                            onClick={() => onUpdate(result.id, { in_cover_video: !result.in_cover_video })}
                            title={result.in_cover_video ? 'Retirer « Vu dans la vidéo »' : 'Marquer « Vu dans la vidéo »'}
                            className={`flex items-center justify-center rounded-md transition-colors ${
                              result.in_cover_video
                                ? 'h-6 w-6 bg-[#ff1493] text-white shadow-sm shadow-[#ff1493]/40'
                                : 'h-6 w-6 text-slate-300 hover:text-[#ff1493]'
                            }`}
                          >
                            <Video className="h-3.5 w-3.5" />
                          </button>
                          {result.review_state === 'reviewed' && (
                            onValidateReview ? (
                              <button
                                type="button"
                                onClick={() => onValidateReview(result)}
                                className="flex items-center gap-1 rounded-md bg-blue-500 px-1.5 py-1 text-[10px] font-semibold text-white hover:bg-blue-600"
                                title={t('review.reviewed')}
                              >
                                <CheckCircle2 className="h-3 w-3" /> {t('review.validate')}
                              </button>
                            ) : (
                              <span className="flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700" title={t('review.reviewed')}>
                                <CheckCircle2 className="h-3 w-3" /> {t('review.reviewed')}
                              </span>
                            )
                          )}
                          {onSendToCollab && (
                            sentCollabIds?.has(result.id) ? (
                              <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700" title={t('action.sent')}>
                                <CheckCircle2 className="h-3 w-3" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSendToCollab(result)}
                                className="text-slate-400 hover:text-emerald-600"
                                title={t('action.sendToCollab')}
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )
                          )}
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
                          {onDeleteResult && (
                            <button
                              type="button"
                              disabled={deletingIds.has(result.id)}
                              onClick={async () => {
                                if (!window.confirm(`Supprimer « ${result.title} » de cette catégorie ?`)) return;
                                setDeletingIds((prev) => new Set(prev).add(result.id));
                                try {
                                  await onDeleteResult(result);
                                } finally {
                                  setDeletingIds((prev) => {
                                    const n = new Set(prev);
                                    n.delete(result.id);
                                    return n;
                                  });
                                }
                              }}
                              className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                              title="Supprimer ce produit de la catégorie"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
                    <span>🏭</span> {t('section.factories')} ({factories.length})
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
                              {result.price != null && result.price > 0 && (
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
            <p className="pl-4 text-sm text-slate-400">{t('table.noImageResults')}</p>
          );
          })()}
        </div>
        </div>
        );
      })}
    </div>
    </>
  );
}
