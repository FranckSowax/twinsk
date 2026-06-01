'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Mail, Phone, FileText, Copy, ExternalLink, Plus, Share2, CheckCircle2, FileJson, CheckSquare, Square, Check, X, Clock, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import SearchTrigger from '@/components/admin/SearchTrigger';
import RetranslateButton from '@/components/admin/RetranslateButton';
import ResultsTable from '@/components/admin/ResultsTable';
import MarginControls from '@/components/admin/MarginControls';
import DocumentTypeSelector from '@/components/admin/DocumentTypeSelector';
import AddRequestItemModal from '@/components/admin/AddRequestItemModal';
import BulkImportModal from '@/components/admin/BulkImportModal';
import type { Request as RequestType, DocumentType } from '@/lib/types/database';

interface RequestItemWithResults {
  id: string;
  image_url: string | null;
  description: string | null;
  client_note: string | null;
  processed: boolean;
  added_by: 'client' | 'admin';
  search_results: {
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
    has_battery: boolean | null;
    info_manquante: string | null;
    dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
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
  }[];
}

export default function AdminRequestDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const [request, setRequest] = useState<RequestType | null>(null);
  const [items, setItems] = useState<RequestItemWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('devis');
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [proposalLinkCopied, setProposalLinkCopied] = useState(false);

  const loadData = useCallback(async () => {
    const [reqRes, resultsRes] = await Promise.all([
      fetch(`/api/requests/${uuid}`),
      fetch(`/api/requests/${uuid}/results`),
    ]);

    const reqData = await reqRes.json();
    const resultsData = await resultsRes.json();

    if (reqRes.ok) setRequest(reqData);
    if (Array.isArray(resultsData)) setItems(resultsData);
    setLoading(false);
  }, [uuid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateResult = async (resultId: string, fields: Record<string, unknown>) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        search_results: item.search_results.map((r) =>
          r.id === resultId ? { ...r, ...fields } : r
        ),
      }))
    );

    await fetch(`/api/requests/${uuid}/results`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id: resultId, ...fields }] }),
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
    await fetch(`/api/requests/${uuid}/results`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
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

    await fetch(`/api/requests/${uuid}/results`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
  };

  const handleGenerateQuote = async () => {
    const selectedCount = items.flatMap((i) => i.search_results).filter((r) => r.selected).length;
    if (!selectedCount) {
      alert('Veuillez sélectionner au moins un produit');
      return;
    }

    setGenerating(true);
    try {

      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: uuid, document_type: documentType }),
      });
      const data = await res.json();

      if (res.ok && data.id) {
        window.open(`/quote/${data.id}`, '_blank');
      } else {
        alert(data.error || 'Erreur génération devis');
      }
    } catch {
      alert('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (!request) {
    return <p className="py-20 text-center text-slate-500">Demande non trouvée</p>;
  }

  const selectedResults = items.flatMap((i) => i.search_results).filter((r) => r.selected);
  const clientLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/request/${uuid}`;

  // Client feedback summary: counts of products the client has reviewed
  const allResults = items.flatMap((i) => i.search_results);
  const totalResults = allResults.length;
  const clientChosen = allResults.filter((r) => r.client_selected === true).length;
  const clientRefused = allResults.filter((r) => r.client_selected === false).length;
  const clientPending = allResults.filter((r) => r.client_selected === null).length;
  const itemsWithNote = items.filter((i) => i.client_note && i.client_note.trim().length > 0).length;
  const hasClientFeedback =
    request?.status === 'client_reviewed' ||
    clientChosen > 0 ||
    clientRefused > 0 ||
    itemsWithNote > 0;

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/admin/requests"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux demandes
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Demande de {request.client_name || 'client'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Créée le {new Date(request.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Client info card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Nom</p>
            <p className="font-medium text-slate-900 dark:text-white">{request.client_name || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Email</p>
            <p className="font-medium text-slate-900 dark:text-white">{request.client_email || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Téléphone</p>
            <p className="font-medium text-slate-900 dark:text-white">{request.client_phone || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Notes</p>
            <p className="font-medium text-slate-900 dark:text-white">{request.notes || '—'}</p>
          </div>
        </div>
      </motion.div>

      {/* Client feedback summary — visible as soon as the client has reviewed at least one product */}
      {hasClientFeedback && totalResults > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50/50 p-5 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-green-900/10"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Retour client
                </p>
                <p className="text-xs text-slate-500">
                  {request.status === 'client_reviewed'
                    ? 'Le client a validé sa sélection'
                    : 'Validation partielle en cours'}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300">
              {totalResults} produit(s)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Choisis</p>
                <p className="font-display text-xl font-bold tabular-nums text-green-600 dark:text-green-400">{clientChosen}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <X className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Refusés</p>
                <p className="font-display text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{clientRefused}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sans avis</p>
                <p className="font-display text-xl font-bold tabular-nums text-slate-600 dark:text-slate-300">{clientPending}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avec note</p>
                <p className="font-display text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400">{itemsWithNote}</p>
              </div>
            </div>
          </div>
          {itemsWithNote > 0 && (
            <details className="group mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-900/10">
              <summary className="cursor-pointer text-sm font-semibold text-purple-700 dark:text-purple-300">
                Voir les {itemsWithNote} note(s) client
              </summary>
              <div className="mt-2 space-y-2">
                {items
                  .filter((i) => i.client_note && i.client_note.trim())
                  .map((i) => (
                    <div key={i.id} className="rounded-lg bg-white p-3 text-sm dark:bg-slate-800">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Article : {i.description?.slice(0, 60) || 'Sans description'}
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">{i.client_note}</p>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </motion.div>
      )}

      {/* Client link */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <ExternalLink className="h-4 w-4 text-slate-400" />
        <code className="flex-1 truncate text-sm text-slate-600 dark:text-slate-400">
          {clientLink}
        </code>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(clientLink); }}
          className="flex items-center gap-1 rounded-lg px-3 py-1 text-sm text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
        >
          <Copy className="h-3.5 w-3.5" />
          Copier
        </button>
      </div>

      {/* Search + Translate + Add item triggers */}
      <div className="flex flex-wrap items-start gap-3">
        <SearchTrigger requestId={uuid} onSearchComplete={loadData} />
        {items.some((i) => i.search_results.length > 0) && (
          <RetranslateButton requestId={uuid} onComplete={loadData} />
        )}
        <motion.button
          type="button"
          onClick={() => setAddItemOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-6 py-3 font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/10 dark:text-amber-300"
        >
          <Plus className="h-5 w-5" />
          Ajouter un article
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setBulkImportOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-6 py-3 font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300"
          title="Importer un JSON de catégories + produits + variantes"
        >
          <FileJson className="h-5 w-5" />
          Importer JSON
        </motion.button>
      </div>

      {/* Progress bar */}
      {items.length > 0 && (() => {
        const total = items.length;
        const processed = items.filter((i) => i.processed).length;
        const withResults = items.filter((i) => i.search_results.length > 0).length;
        const totalResults = items.reduce((sum, i) => sum + i.search_results.length, 0);
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {processed}/{total} article(s) traité(s) · {totalResults} résultat(s)
              </span>
              <span className="text-xs text-slate-500">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {processed < total && (
              <p className="mt-1.5 text-xs text-slate-400">
                {total - processed} article(s) en attente — cliquez sur &quot;Recherche&quot; pour continuer
              </p>
            )}
          </div>
        );
      })()}

      <AddRequestItemModal
        open={addItemOpen}
        requestId={uuid}
        onClose={() => setAddItemOpen(false)}
        onCreated={loadData}
      />

      <BulkImportModal
        open={bulkImportOpen}
        requestId={uuid}
        onClose={() => setBulkImportOpen(false)}
        onImported={loadData}
      />

      {/* Margin controls + results table — visible as soon as there are items */}
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
                    title="Sélectionner tous les produits"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    title="Désélectionner tous les produits"
                  >
                    <Square className="h-4 w-4" />
                    Tout désélectionner
                  </button>
                  <span className="ml-1 text-xs font-medium text-slate-500">
                    {selectedCount} / {total} sélectionné(s)
                  </span>
                </div>
              </div>
            );
          })()}
          <ResultsTable
            items={items}
            requestId={uuid}
            onUpdate={handleUpdateResult}
            onRefresh={loadData}
          />

          {/* Proposal link — only when at least one result is selected */}
          {selectedResults.length > 0 && (
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5 dark:border-purple-800 dark:from-purple-900/20 dark:to-pink-900/20">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                  <Share2 className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Proposition client
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    Envoyez au client un lien où il pourra consulter vos présélections, choisir parmi
                    les options et ajuster les quantités avant de valider.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      readOnly
                      value={
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/proposal/${uuid}`
                          : `/proposal/${uuid}`
                      }
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const link = `${window.location.origin}/proposal/${uuid}`;
                        navigator.clipboard.writeText(link);
                        setProposalLinkCopied(true);
                        setTimeout(() => setProposalLinkCopied(false), 2000);
                      }}
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25"
                    >
                      {proposalLinkCopied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Copié !
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copier le lien
                        </>
                      )}
                    </motion.button>
                    <motion.a
                      href={`/proposal/${uuid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 rounded-xl border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-700 dark:border-purple-700 dark:bg-slate-800 dark:text-purple-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Aperçu
                    </motion.a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Document type + Generate — only when there's at least one result */}
          {items.some((i) => i.search_results.length > 0) && (
          <>
          <DocumentTypeSelector value={documentType} onChange={setDocumentType} />

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {selectedResults.length} produit(s) sélectionné(s)
              </p>
              <p className="text-sm text-slate-500">
                Prêt à générer le {documentType === 'devis' ? 'devis' : 'packing list'}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleGenerateQuote}
              disabled={generating || !selectedResults.length}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
            >
              {generating ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Génération...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Générer le {documentType === 'devis' ? 'devis' : 'packing list'}
                </>
              )}
            </motion.button>
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
