'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Mail, Phone, FileText, Copy, ExternalLink, Plus, Share2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import SearchTrigger from '@/components/admin/SearchTrigger';
import RetranslateButton from '@/components/admin/RetranslateButton';
import ResultsTable from '@/components/admin/ResultsTable';
import MarginControls from '@/components/admin/MarginControls';
import DocumentTypeSelector from '@/components/admin/DocumentTypeSelector';
import AddRequestItemModal from '@/components/admin/AddRequestItemModal';
import type { Request as RequestType, DocumentType } from '@/lib/types/database';

interface RequestItemWithResults {
  id: string;
  image_url: string | null;
  description: string | null;
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
      </div>

      <AddRequestItemModal
        open={addItemOpen}
        requestId={uuid}
        onClose={() => setAddItemOpen(false)}
        onCreated={loadData}
      />

      {/* Margin controls + results table — visible as soon as there are items */}
      {items.length > 0 && (
        <>
          {items.some((i) => i.search_results.length > 0) && (
            <MarginControls onApplyGlobal={handleApplyGlobalMargin} />
          )}
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
