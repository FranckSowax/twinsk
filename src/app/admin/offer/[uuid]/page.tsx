'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileJson,
  Loader2,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import ResultsTable from '@/components/admin/ResultsTable';
import MarginControls from '@/components/admin/MarginControls';
import AddRequestItemModal from '@/components/admin/AddRequestItemModal';
import BulkImportModal from '@/components/admin/BulkImportModal';

interface OfferRow {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  cover_image_url: string | null;
  created_at: string;
}

interface OfferProduct {
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

interface OfferItemWithProducts {
  id: string;
  image_url: string | null;
  description: string | null;
  processed: boolean;
  added_by: 'client' | 'admin';
  search_results: OfferProduct[];
}

export default function AdminOfferDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [items, setItems] = useState<OfferItemWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [themeDraft, setThemeDraft] = useState('');
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [oRes, rRes] = await Promise.all([
      fetch(`/api/offers/${uuid}`),
      fetch(`/api/offers/${uuid}/results`),
    ]);
    const oData = await oRes.json();
    const rData = await rRes.json();
    if (oRes.ok) {
      setOffer(oData);
      setTitleDraft(oData.title || '');
      setThemeDraft(oData.theme || '');
    }
    if (Array.isArray(rData)) setItems(rData);
    setLoading(false);
  }, [uuid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateResult = async (resultId: string, fields: Record<string, unknown>) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        search_results: item.search_results.map((r) =>
          r.id === resultId ? { ...r, ...fields } : r
        ),
      }))
    );
    await fetch(`/api/offers/${uuid}/results`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id: resultId, ...fields }] }),
    });
  };

  const handleApplyGlobalMargin = async (margin: number) => {
    const updates: { id: string; margin_percent: number }[] = [];
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        search_results: item.search_results.map((r) => {
          updates.push({ id: r.id, margin_percent: margin });
          return { ...r, margin_percent: margin };
        }),
      }))
    );
    await fetch(`/api/offers/${uuid}/results`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
  };

  const handleToggleAll = async (selected: boolean) => {
    const updates: { id: string; selected: boolean }[] = [];
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        search_results: item.search_results.map((r) => {
          updates.push({ id: r.id, selected });
          return { ...r, selected };
        }),
      }))
    );
    if (!updates.length) return;
    await fetch(`/api/offers/${uuid}/results`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
  };

  const patchOffer = async (patch: Partial<OfferRow>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/offers/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Erreur');
        return;
      }
      const data = await res.json();
      setOffer(data);
      setTitleDraft(data.title || '');
      setThemeDraft(data.theme || '');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!offer) return;
    const next = offer.status === 'published' ? 'draft' : 'published';
    await patchOffer({ status: next });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }
  if (!offer) {
    return <p className="py-20 text-center text-slate-500">Offre introuvable</p>;
  }

  const publicLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/offer/${uuid}`;
  const isPublished = offer.status === 'published';

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link
        href="/admin/offer"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux offres
      </Link>

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title */}
            {editingTitle ? (
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      patchOffer({ title: titleDraft });
                      setEditingTitle(false);
                    }
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  className="flex-1 rounded-xl border border-amber-400 bg-white px-3 py-1.5 font-display text-2xl font-bold text-slate-900 focus:outline-none dark:bg-slate-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    patchOffer({ title: titleDraft });
                    setEditingTitle(false);
                  }}
                  disabled={saving}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  OK
                </button>
              </div>
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                className="cursor-pointer font-display text-2xl font-bold text-slate-900 dark:text-white"
                title="Cliquer pour éditer"
              >
                {offer.title}
              </h1>
            )}

            {/* Theme */}
            <div className="mt-2 flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              {editingTheme ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={themeDraft}
                    onChange={(e) => setThemeDraft(e.target.value)}
                    placeholder="Thème"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        patchOffer({ theme: themeDraft || null });
                        setEditingTheme(false);
                      }
                      if (e.key === 'Escape') setEditingTheme(false);
                    }}
                    className="rounded-lg border border-amber-400 bg-white px-2 py-0.5 text-sm focus:outline-none dark:bg-slate-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      patchOffer({ theme: themeDraft || null });
                      setEditingTheme(false);
                    }}
                    className="rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTheme(true)}
                  className="text-sm text-purple-600 hover:underline dark:text-purple-300"
                >
                  {offer.theme || '+ ajouter un thème'}
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Créée le{' '}
              {new Date(offer.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <motion.button
              type="button"
              onClick={togglePublish}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={saving}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition-colors ${
                isPublished
                  ? 'bg-green-500 text-white shadow-green-500/25 hover:bg-green-600'
                  : 'border-2 border-amber-400 bg-white text-amber-700 hover:bg-amber-50 dark:bg-slate-700 dark:text-amber-300'
              }`}
            >
              {isPublished ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Publiée
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Publier
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Public link block */}
      {isPublished && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-teal-900/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Lien public à partager
              </h3>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                Diffusez ce lien dans vos groupes WhatsApp / réseaux sociaux. Les
                visiteurs peuvent commander en saisissant nom et numéro WhatsApp.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  readOnly
                  value={publicLink}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                />
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    navigator.clipboard.writeText(publicLink);
                    setPublicLinkCopied(true);
                    setTimeout(() => setPublicLinkCopied(false), 2000);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25"
                >
                  {publicLinkCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {publicLinkCopied ? 'Copié !' : 'Copier'}
                </motion.button>
                <Link
                  href={`/offer/${uuid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
                >
                  <ExternalLink className="h-4 w-4" />
                  Aperçu
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Import buttons */}
      <div className="flex flex-wrap items-start gap-3">
        <motion.button
          type="button"
          onClick={() => setAddItemOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-6 py-3 font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/10 dark:text-amber-300"
        >
          <Plus className="h-5 w-5" />
          Ajouter une catégorie
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setBulkImportOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-6 py-3 font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300"
        >
          <FileJson className="h-5 w-5" />
          Importer JSON
        </motion.button>
        <Link
          href={`/offer/${uuid}`}
          target="_blank"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        >
          <ArrowUpRight className="h-5 w-5" />
          Vue publique
        </Link>
      </div>

      <AddRequestItemModal
        open={addItemOpen}
        requestId={uuid}
        basePath="/api/offers"
        onClose={() => setAddItemOpen(false)}
        onCreated={loadData}
      />

      <BulkImportModal
        open={bulkImportOpen}
        requestId={uuid}
        basePath="/api/offers"
        onClose={() => setBulkImportOpen(false)}
        onImported={loadData}
      />

      {items.length > 0 && (
        <>
          {items.some((i) => i.search_results.length > 0) && (() => {
            const allResults = items.flatMap((i) => i.search_results);
            const total = allResults.length;
            const selectedCount = allResults.filter((r) => r.selected).length;
            const allSelected = total > 0 && selectedCount === total;
            return (
              <div className="flex flex-wrap items-center gap-3">
                <MarginControls onApplyGlobal={handleApplyGlobalMargin} />
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => handleToggleAll(true)}
                    disabled={allSelected}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    disabled={selectedCount === 0}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    Tout désélectionner
                  </button>
                  <span className="ml-1 text-xs font-medium text-slate-500">
                    {selectedCount} / {total} visible(s) sur l&apos;offre publique
                  </span>
                </div>
              </div>
            );
          })()}
          <ResultsTable
            items={items}
            requestId={uuid}
            basePath="/api/offers"
            manualCreateSuffix="manual-product"
            manualUpdateSuffix="results"
            hideClientFeedback
            onUpdate={handleUpdateResult}
            onRefresh={loadData}
          />
        </>
      )}
    </div>
  );
}
