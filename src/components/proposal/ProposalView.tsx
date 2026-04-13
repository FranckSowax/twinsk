'use client';

import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Send,
  Loader2,
  CheckCircle,
  ImageIcon,
  Info,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  Plus,
  Upload,
  Type,
  X,
} from 'lucide-react';
import { formatCNY, toMultiCurrency } from '@/lib/utils/formatCurrency';
import ProposalDetailModal, { type ProposalResult } from './ProposalDetailModal';
import SmartImage from '@/components/ui/SmartImage';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import NotesThread, { type NoteItem } from '@/components/ui/NotesThread';

interface ProposalItem {
  id: string;
  image_url: string | null;
  description: string | null;
  client_note: string | null;
  notes?: NoteItem[];
  results: ProposalResult[];
}

interface ProposalViewProps {
  requestId: string;
  clientName: string;
  createdAt: string;
  items: ProposalItem[];
}

type ViewMode = 'grid' | 'table';

export default function ProposalView({ requestId, clientName, createdAt, items }: ProposalViewProps) {
  // Local pick state
  const [picks, setPicks] = useState<Record<string, { selected: boolean; quantity: number }>>(() => {
    const init: Record<string, { selected: boolean; quantity: number }> = {};
    items.forEach((item) => {
      item.results.forEach((r) => {
        init[r.id] = {
          selected: r.client_selected === true,
          quantity: r.client_quantity ?? r.quantity ?? 1,
        };
      });
    });
    return init;
  });

  // Notes per item_id
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    items.forEach((item) => {
      init[item.id] = item.client_note || '';
    });
    return init;
  });

  const [activeResult, setActiveResult] = useState<ProposalResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleTogglePick = (id: string, selected: boolean) => {
    setPicks((prev) => ({ ...prev, [id]: { ...prev[id], selected } }));
  };

  const handleQtyChange = (id: string, quantity: number) => {
    setPicks((prev) => ({ ...prev, [id]: { ...prev[id], quantity } }));
  };

  const handleNoteChange = (itemId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [itemId]: value }));
  };

  // Aggregated totals
  const totals = useMemo(() => {
    let total = 0;
    let count = 0;
    items.forEach((item) => {
      item.results.forEach((r) => {
        const p = picks[r.id];
        if (p?.selected) {
          total += r.price * (p.quantity || 1);
          count++;
        }
      });
    });
    return { total, count };
  }, [picks, items]);

  // Determine which items have zero selections (need notes)
  const itemsNeedingNote = useMemo(() => {
    const ids: string[] = [];
    items.forEach((item) => {
      if (item.results.length === 0) return;
      const anySelected = item.results.some((r) => picks[r.id]?.selected);
      if (!anySelected) ids.push(item.id);
    });
    return ids;
  }, [picks, items]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    // Note: validation removed — client can submit without notes on unselected items
    // The absence of selection is already a clear signal for the admin

    try {
      const payload = {
        picks: Object.entries(picks).map(([result_id, p]) => ({
          result_id,
          client_selected: p.selected,
          client_quantity: p.quantity,
        })),
        notes: Object.entries(notes).map(([item_id, note]) => ({ item_id, note })),
      };
      const res = await fetch(`/api/proposal/${requestId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center shadow-xl sm:p-12 dark:from-green-900/20 dark:to-emerald-900/20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500"
        >
          <CheckCircle className="h-12 w-12 text-white" />
        </motion.div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Vos choix ont été enregistrés !
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Notre équipe finalise votre devis et vous recontacte très prochainement.
        </p>
        <div className="mt-6 inline-flex flex-col items-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow dark:bg-slate-800 dark:text-slate-200">
          <span className="mb-1 text-xs text-slate-400">{totals.count} produit(s) choisi(s)</span>
          <MultiCurrencyPrice amountCny={totals.total} variant="stacked" />
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <ProposalDetailModal
        result={
          activeResult
            ? (() => {
                const live = items.flatMap((i) => i.results).find((r) => r.id === activeResult.id);
                if (!live) return null;
                return {
                  ...live,
                  client_selected: picks[live.id]?.selected ?? false,
                  client_quantity: picks[live.id]?.quantity ?? live.quantity,
                };
              })()
            : null
        }
        onClose={() => setActiveResult(null)}
        onToggleSelect={handleTogglePick}
        onQuantityChange={handleQtyChange}
      />

      <AddMoreItemsModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddError('');
        }}
        requestId={requestId}
        onSubmitted={() => {
          // Reload to show new items (server-side data is fresh)
          window.location.reload();
        }}
        error={addError}
        setError={setAddError}
      />

      <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Proposition de sourcing
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Bonjour {clientName} 👋
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base dark:text-slate-400">
            Voici les produits présélectionnés par notre équipe pour votre demande. Consultez chaque
            proposition, ajustez les quantités et validez vos choix finaux.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Créée le{' '}
            {new Date(createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>

          {/* Toolbar */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-amber-600 shadow-sm dark:bg-slate-700 dark:text-amber-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grille
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-amber-600 shadow-sm dark:bg-slate-700 dark:text-amber-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                Table
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un produit à rechercher
            </button>
          </div>
        </div>

        {/* Items */}
        {items.map((item, itemIdx) => {
          const needsNote = itemsNeedingNote.includes(item.id);
          return (
            <motion.div
              key={item.id}
              ref={(el) => {
                sectionRefs.current[item.id] = el;
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: itemIdx * 0.05 }}
              className={`space-y-4 rounded-3xl border p-5 shadow-sm sm:p-6 ${
                needsNote
                  ? 'border-amber-400 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              {/* Client item header */}
              <div className="flex gap-4 border-b border-slate-100 pb-4 dark:border-slate-700">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-24 sm:w-24 dark:bg-slate-700">
                  {item.image_url ? (
                    <SmartImage
                      src={item.image_url}
                      alt={`Article ${itemIdx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Votre article #{itemIdx + 1}
                  </p>
                  {item.description && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                  )}
                  {item.results.length > 1 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                      <Info className="h-3 w-3" />
                      {item.results.length} options — choisissez celle(s) que vous préférez
                    </div>
                  )}
                </div>
              </div>

              {/* Results */}
              {item.results.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {item.results.map((result) => {
                      const pick = picks[result.id];
                      const selected = pick?.selected ?? false;
                      const qty = pick?.quantity ?? result.quantity ?? 1;
                      return (
                        <motion.button
                          type="button"
                          key={result.id}
                          layout
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveResult(result)}
                          className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all ${
                            selected
                              ? 'border-green-500 bg-green-50/50 shadow-lg shadow-green-500/10 dark:bg-green-900/10'
                              : 'border-slate-200 bg-white hover:border-amber-400 dark:border-slate-600 dark:bg-slate-700/50'
                          }`}
                        >
                          <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                            <SmartImage
                              src={result.image_url}
                              fallbackSrc={result.thumbnail_url || null}
                              alt={result.title}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            {selected && (
                              <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col p-3">
                            <p
                              className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-900 dark:text-white"
                              title={result.title}
                            >
                              {result.title}
                            </p>
                            <div className="mt-2">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-base font-bold text-amber-500">
                                  {formatCNY(result.price)}
                                </p>
                                {selected && (
                                  <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                                    × {qty}
                                  </p>
                                )}
                              </div>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {toMultiCurrency(result.price).formatted.xaf}
                              </p>
                            </div>
                            {result.moq != null && (
                              <p className="mt-1 text-[10px] text-slate-400">MOQ: {result.moq}</p>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  // Table view
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full min-w-[560px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
                          <th className="w-10 px-2 py-2"></th>
                          <th className="px-2 py-2">Produit</th>
                          <th className="px-2 py-2 text-right">Prix</th>
                          <th className="px-2 py-2 text-center">Qté</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {item.results.map((result) => {
                          const pick = picks[result.id];
                          const selected = pick?.selected ?? false;
                          const qty = pick?.quantity ?? result.quantity ?? 1;
                          return (
                            <tr
                              key={result.id}
                              onClick={() => setActiveResult(result)}
                              className={`cursor-pointer transition-colors ${
                                selected
                                  ? 'bg-green-50/50 dark:bg-green-900/10'
                                  : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/30'
                              }`}
                            >
                              <td className="px-2 py-3 text-center">
                                <div
                                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-lg border-2 ${
                                    selected
                                      ? 'border-green-500 bg-green-500 text-white'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {selected && <Check className="h-3.5 w-3.5" />}
                                </div>
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                                    <SmartImage
                                      src={result.image_url}
                                      fallbackSrc={result.thumbnail_url || null}
                                      alt={result.title}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
                                    {result.title}
                                  </p>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-right">
                                <div className="text-sm font-bold text-amber-500">
                                  {formatCNY(result.price)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {toMultiCurrency(result.price).formatted.xaf}
                                </div>
                              </td>
                              <td className="px-2 py-3 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                                {selected ? qty : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <p className="text-sm text-slate-400">Aucune proposition pour cet article.</p>
              )}

              {/* Conversation notes (admin ↔ client) */}
              <NotesThread
                notes={item.notes || []}
                requestItemId={item.id}
                currentUser="client"
                onNoteAdded={() => window.location.reload()}
              />

              {/* Client note section — required if no selection */}
              {(needsNote || notes[item.id]) && (
                <div
                  className={`rounded-2xl border p-4 ${
                    needsNote
                      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/20'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/30'
                  }`}
                >
                  <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <MessageSquare className="h-3 w-3" />
                    {needsNote ? 'Note requise — dites-nous ce que vous recherchez' : 'Note (optionnelle)'}
                  </label>
                  <textarea
                    value={notes[item.id] || ''}
                    onChange={(e) => handleNoteChange(item.id, e.target.value)}
                    placeholder={
                      needsNote
                        ? "Ex: Aucun de ces produits ne correspond, je cherche plutôt..."
                        : 'Précisions supplémentaires...'
                    }
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Sticky footer submit bar */}
        <div className="sticky bottom-4 z-10 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-2xl backdrop-blur sm:p-6 dark:border-slate-700 dark:bg-slate-800/90">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mes choix ({totals.count} produit{totals.count > 1 ? 's' : ''})
              </p>
              <MultiCurrencyPrice amountCny={totals.total} variant="stacked" />
            </div>
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Valider mes choix
                </>
              )}
            </motion.button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </>
  );
}

// ---------- AddMoreItemsModal (inline component) ----------

interface AddMoreItemsModalProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  onSubmitted: () => void;
  error: string;
  setError: (v: string) => void;
}

function AddMoreItemsModal({
  open,
  onClose,
  requestId,
  onSubmitted,
  error,
  setError,
}: AddMoreItemsModalProps) {
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageDesc, setImageDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setText('');
    setImageUrl('');
    setImageDesc('');
    setMode('image');
    setError('');
  };

  const handleClose = () => {
    if (saving || uploading) return;
    reset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload échoué');
      setImageUrl(data.urls[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (mode === 'image' && !imageUrl) {
      setError('Veuillez sélectionner une image');
      return;
    }
    if (mode === 'text' && !text.trim()) {
      setError('Veuillez décrire le produit recherché');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              image_url: mode === 'image' ? imageUrl : null,
              description: mode === 'image' ? imageDesc.trim() || null : text.trim(),
            },
          ],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      reset();
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="my-8 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Ajouter un produit à rechercher
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('image')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${
                mode === 'image'
                  ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'border-slate-200 text-slate-500 dark:border-slate-600'
              }`}
            >
              <Upload className="h-4 w-4" /> Photo
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${
                mode === 'text'
                  ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'border-slate-200 text-slate-500 dark:border-slate-600'
              }`}
            >
              <Type className="h-4 w-4" /> Texte
            </button>
          </div>

          {mode === 'image' ? (
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm font-medium text-slate-600 hover:border-amber-400 hover:bg-amber-50 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Upload...
                  </>
                ) : imageUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />
                    <span className="text-xs text-slate-500">Cliquer pour changer</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Choisir une photo
                  </>
                )}
              </button>
              <textarea
                value={imageDesc}
                onChange={(e) => setImageDesc(e.target.value)}
                placeholder="Description (optionnelle) : quantité, couleur, taille..."
                rows={2}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Décrivez le produit recherché : nom, matière, quantité, couleur..."
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            Annuler
          </button>
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Envoi...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Ajouter
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
