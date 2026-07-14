'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip);
}
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  PackagePlus,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileJson,
  ImageIcon,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import ResultsTable from '@/components/admin/ResultsTable';
import ProposalCurrencyModal, { type ProposalCurrency } from '@/components/admin/ProposalCurrencyModal';
import JsonImportsButton from '@/components/admin/JsonImportsButton';
import AffiliateLinksButton from '@/components/admin/AffiliateLinksButton';
import ExportOfferButton from '@/components/admin/ExportOfferButton';
import MarginControls from '@/components/admin/MarginControls';
import AddRequestItemModal from '@/components/admin/AddRequestItemModal';
import BulkImportModal from '@/components/admin/BulkImportModal';
import ImportFromOfferModal from '@/components/admin/ImportFromOfferModal';
import { useAdminT } from '@/components/admin/LocaleProvider';

interface OfferRow {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  cover_image_url: string | null;
  created_at: string;
  offer_currency?: string | null;
  offer_type?: string | null; // 'b2c' (défaut) | 'b2b'
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
  review_state?: string | null;
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
  const { t } = useAdminT();
  const { uuid } = useParams<{ uuid: string }>();
  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [items, setItems] = useState<OfferItemWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [importOfferOpen, setImportOfferOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [themeDraft, setThemeDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);
  const [broadcastImageMode, setBroadcastImageMode] = useState<'cover' | 'upload'>('cover');
  const [broadcastUploadUrl, setBroadcastUploadUrl] = useState<string | null>(null);
  const [broadcastUploading, setBroadcastUploading] = useState(false);
  const broadcastFileRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [sentCollabIds, setSentCollabIds] = useState<Set<string>>(new Set());
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [offerCurrency, setOfferCurrency] = useState<ProposalCurrency>('XAF');

  // Rôle : le bouton « Envoyer aux collaborateurs » est réservé à l'admin.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setIsAdminUser(d?.role === 'admin'))
      .catch(() => {});
  }, []);

  const sendToCollab = useCallback(
    async (result: { id: string }) => {
      try {
        const res = await fetch('/api/collab-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offer_id: uuid, product_id: result.id }),
        });
        if (res.ok) {
          setSentCollabIds((prev) => new Set(prev).add(result.id));
        } else {
          const j = await res.json().catch(() => ({}));
          alert(j.error || 'Erreur envoi');
        }
      } catch {
        alert('Erreur réseau');
      }
    },
    [uuid],
  );

  const validateReview = useCallback(
    async (result: { id: string }) => {
      try {
        const res = await fetch(`/api/offers/${uuid}/validate-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: result.id }),
        });
        if (res.ok) {
          // Repasse la ligne en normal localement.
          setItems((prev) =>
            prev.map((item) => ({
              ...item,
              search_results: item.search_results.map((r) =>
                r.id === result.id ? { ...r, review_state: null } : r,
              ),
            })),
          );
        } else {
          const j = await res.json().catch(() => ({}));
          alert(j.error || 'Erreur validation');
        }
      } catch {
        alert('Erreur réseau');
      }
    },
    [uuid],
  );

  const loadData = useCallback(async () => {
    const [oRes, rRes] = await Promise.all([
      fetch(`/api/offers/${uuid}`),
      fetch(`/api/offers/${uuid}/results`),
    ]);
    const oData = await oRes.json();
    const rData = await rRes.json();
    if (oRes.ok) {
      setOffer(oData);
      if (oData.offer_currency) setOfferCurrency(oData.offer_currency);
      setTitleDraft(oData.title || '');
      setThemeDraft(oData.theme || '');
      setDescDraft(oData.description || '');
    }
    if (Array.isArray(rData)) setItems(rData);
    setLoading(false);
  }, [uuid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reorderCategories = useCallback(
    async (orderedItemIds: string[]) => {
      // Réordonne localement (optimiste).
      setItems((prev) => {
        const byId = new Map(prev.map((it) => [it.id, it]));
        const next = orderedItemIds.map((id) => byId.get(id)).filter(Boolean) as typeof prev;
        for (const it of prev) if (!orderedItemIds.includes(it.id)) next.push(it);
        return next;
      });
      try {
        const res = await fetch(`/api/offers/${uuid}/reorder-categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedItemIds }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          alert(j.error || 'Erreur réordonnancement');
          loadData();
        }
      } catch {
        alert('Erreur réseau');
        loadData();
      }
    },
    [uuid, loadData],
  );

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
      setDescDraft(data.description || '');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!offer) return;
    const next = offer.status === 'published' ? 'draft' : 'published';
    await patchOffer({ status: next });
  };

  const handleBroadcastImageFile = async (file: File) => {
    setBroadcastUploading(true);
    setBroadcastMsg(null);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.urls?.[0]) {
        setBroadcastMsg(`❌ ${data.error || 'Erreur upload image'}`);
        return;
      }
      setBroadcastUploadUrl(data.urls[0]);
      setBroadcastImageMode('upload');
    } finally {
      setBroadcastUploading(false);
    }
  };

  const broadcastToGroup = async () => {
    const imageUrl =
      broadcastImageMode === 'upload' ? broadcastUploadUrl : offer?.cover_image_url || null;
    setBroadcasting(true);
    setBroadcastMsg(null);
    try {
      const res = await fetch(`/api/offers/${uuid}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: window.location.origin, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBroadcastMsg(`❌ ${data.error || 'Échec de la diffusion'}`);
        return;
      }
      const parts = ['✅ Diffusé dans le groupe WhatsApp'];
      if (imageUrl && !data.imageSent) parts.push('(image non envoyée)');
      if (data.buttonFallback) parts.push('(bouton indisponible → lien texte)');
      setBroadcastMsg(parts.join(' '));
    } catch {
      setBroadcastMsg('❌ Erreur réseau');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleCoverFile = async (file: File) => {
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.urls?.[0]) {
        alert(data.error || 'Erreur upload');
        return;
      }
      await patchOffer({ cover_image_url: data.urls[0] });
    } finally {
      setCoverUploading(false);
    }
  };

  const removeCover = async () => {
    if (!offer?.cover_image_url) return;
    if (!window.confirm('Retirer la cover de cette offre ?')) return;
    await patchOffer({ cover_image_url: null });
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
      {/* Back — vers la liste B2B ou B2C selon le type de l'offre */}
      <Link
        href={offer.offer_type === 'b2b' ? '/admin/offer-b2b' : '/admin/offer'}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-500"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('offer.back')}
      </Link>

      {/* Cover image uploader */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {offer.cover_image_url ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={offer.cover_image_url}
              alt="Cover"
              className="h-48 w-full object-cover sm:h-64"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div>
                {offer.theme && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/90 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
                    <Tag className="h-3 w-3" />
                    {offer.theme}
                  </span>
                )}
                <p className="mt-1 font-display text-lg font-bold text-white drop-shadow sm:text-xl">
                  {offer.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => coverFileRef.current?.click()}
                  disabled={coverUploading}
                  className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white disabled:opacity-60"
                >
                  {coverUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Remplacer
                </button>
                <button
                  type="button"
                  onClick={removeCover}
                  disabled={coverUploading}
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-600 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Retirer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverFileRef.current?.click()}
            disabled={coverUploading}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-700 transition-colors hover:from-emerald-100 hover:to-green-100 disabled:opacity-60 dark:from-emerald-900/20 dark:to-green-900/20"
          >
            {coverUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-semibold">Envoi en cours…</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm font-semibold">
                  Ajouter une image de couverture
                </span>
                <span className="text-xs text-emerald-600/80">
                  Sera affichée en haut de la page publique avec le thème
                </span>
              </>
            )}
          </button>
        )}
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCoverFile(f);
            e.target.value = '';
          }}
        />
      </div>

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

            {/* Description */}
            <div className="mt-3">
              {editingDesc ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    placeholder="Description de l'offre (affichée sur la page publique)"
                    autoFocus
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        patchOffer({ description: descDraft.trim() || null });
                        setEditingDesc(false);
                      }
                      if (e.key === 'Escape') {
                        setDescDraft(offer.description || '');
                        setEditingDesc(false);
                      }
                    }}
                    className="w-full resize-y rounded-xl border border-amber-400 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none dark:bg-slate-700 dark:text-white"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        patchOffer({ description: descDraft.trim() || null });
                        setEditingDesc(false);
                      }}
                      disabled={saving}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescDraft(offer.description || '');
                        setEditingDesc(false);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                    >
                      Annuler
                    </button>
                    <span className="text-xs text-slate-400">⌘/Ctrl + Entrée pour enregistrer</span>
                  </div>
                </div>
              ) : offer.description ? (
                <button
                  type="button"
                  onClick={() => setEditingDesc(true)}
                  title="Cliquer pour éditer"
                  className="block w-full cursor-pointer whitespace-pre-wrap rounded-lg px-1 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/40"
                >
                  {offer.description}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingDesc(true)}
                  className="text-sm text-slate-400 hover:text-amber-500 hover:underline"
                >
                  + ajouter une description
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
                  {t('action.published')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('action.publish')}
                </>
              )}
            </motion.button>

            {/* Devise affichée au client (défaut FCFA) */}
            <button
              type="button"
              onClick={() => setCurrencyModalOpen(true)}
              title="Devise affichée au client sur le lien public"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
            >
              <span>💱</span> Devise&nbsp;: <span className="font-display tabular-nums text-emerald-600">{offerCurrency}</span>
            </button>

            <JsonImportsButton targetType="offer" targetId={uuid} isAdmin={isAdminUser} />

            {isAdminUser && <AffiliateLinksButton offerId={uuid} />}
          </div>
        </div>
      </motion.div>

      {/* Modal choix de devise */}
      <ProposalCurrencyModal
        open={currencyModalOpen}
        currentCurrency={offerCurrency}
        apiUrl={`/api/offers/${uuid}`}
        bodyKey="offer_currency"
        onClose={() => setCurrencyModalOpen(false)}
        onSaved={(cur) => {
          setOfferCurrency(cur);
          setOffer((prev) => (prev ? { ...prev, offer_currency: cur } : prev));
        }}
      />

      {/* Public link block */}
      {isPublished && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-teal-900/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {t('offer.publicLink')}
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
                  {publicLinkCopied ? t('offer.copied') : t('offer.copy')}
                </motion.button>
                <Link
                  href={`/offer/${uuid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('offer.preview')}
                </Link>
              </div>

              {/* Diffusion dans le groupe WhatsApp (via WHAPI) : image + message + bouton */}
              {(() => {
                const chosenImage =
                  broadcastImageMode === 'upload' ? broadcastUploadUrl : offer.cover_image_url;
                return (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Diffusion WhatsApp — image + message
                    </p>

                    {/* Choix de l'image */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBroadcastImageMode('cover')}
                        disabled={!offer.cover_image_url}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          broadcastImageMode === 'cover'
                            ? 'bg-emerald-500 text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Cover de l’offre
                      </button>
                      <button
                        type="button"
                        onClick={() => broadcastFileRef.current?.click()}
                        disabled={broadcastUploading}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          broadcastImageMode === 'upload'
                            ? 'bg-emerald-500 text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {broadcastUploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {broadcastUploadUrl ? 'Changer l’image' : 'Uploader une image'}
                      </button>
                      <input
                        ref={broadcastFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleBroadcastImageFile(f);
                          e.target.value = '';
                        }}
                      />
                    </div>

                    {/* Aperçu image + message */}
                    <div className="mt-3 flex gap-3">
                      {chosenImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={chosenImage}
                          alt="Image de diffusion"
                          className="h-16 w-16 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400 dark:bg-slate-700">
                          sans image
                        </div>
                      )}
                      <div className="min-w-0 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">{offer.title}</p>
                        {offer.theme && <p className="italic">{offer.theme}</p>}
                        {offer.description && <p className="line-clamp-2">{offer.description}</p>}
                        <p className="mt-1 text-emerald-600">＋ bouton « Voir l’offre » → lien public</p>
                      </div>
                    </div>

                    {/* Bouton diffuser */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <motion.button
                        type="button"
                        onClick={broadcastToGroup}
                        disabled={broadcasting}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/25 disabled:opacity-60"
                      >
                        {broadcasting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {t('offer.broadcastGroup')}
                      </motion.button>
                      {broadcastMsg && (
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {broadcastMsg}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
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
          {t('action.addCategory')}
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setBulkImportOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-6 py-3 font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300"
        >
          <FileJson className="h-5 w-5" />
          {t('action.importJson')}
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setImportOfferOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-6 py-3 font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/10 dark:text-indigo-300"
          title="Copier des produits depuis une autre offre"
        >
          <PackagePlus className="h-5 w-5" />
          Importer d’une offre
        </motion.button>
        <ExportOfferButton offerId={uuid} title={offer.title} />
        <Link
          href={`/offer/${uuid}`}
          target="_blank"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        >
          <ArrowUpRight className="h-5 w-5" />
          {t('action.publicView')}
        </Link>
      </div>

      <AddRequestItemModal
        open={addItemOpen}
        requestId={uuid}
        basePath="/api/offers"
        onClose={() => setAddItemOpen(false)}
        onCreated={loadData}
      />

      <ImportFromOfferModal
        open={importOfferOpen}
        currentUuid={uuid}
        targetCategories={items.map((it) => ({ id: it.id, description: it.description }))}
        onClose={() => setImportOfferOpen(false)}
        onImported={loadData}
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
                    {t('action.selectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    disabled={selectedCount === 0}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    {t('action.deselectAll')}
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
            onSendToCollab={isAdminUser ? sendToCollab : undefined}
            sentCollabIds={sentCollabIds}
            onValidateReview={isAdminUser ? validateReview : undefined}
            onReorderCategories={reorderCategories}
            onMoveResult={async (productId, fromItemId, toItemId) => {
              // 1. Capture l'etat AVANT le changement (toutes les lignes produit).
              const state = Flip.getState('[data-flip-id]', {
                props: 'backgroundColor,borderColor,boxShadow',
              });

              // 2. Optimistic move via flushSync pour que React applique le
              //    re-rendu de maniere synchrone avant Flip.from().
              flushSync(() => {
                setItems((prev) => {
                  const moved = prev
                    .find((it) => it.id === fromItemId)?.search_results
                    .find((r) => r.id === productId);
                  if (!moved) return prev;
                  return prev.map((it) => {
                    if (it.id === fromItemId) {
                      return {
                        ...it,
                        search_results: it.search_results.filter((r) => r.id !== productId),
                      };
                    }
                    if (it.id === toItemId) {
                      return { ...it, search_results: [...it.search_results, moved] };
                    }
                    return it;
                  });
                });
              });

              // 3. Animation FLIP : interpole de l ancienne position vers la nouvelle.
              Flip.from(state, {
                duration: 0.55,
                ease: 'power3.inOut',
                absolute: true,
                stagger: 0.02,
                onEnter: (elements) =>
                  gsap.fromTo(
                    elements,
                    { opacity: 0, scale: 0.92 },
                    { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' },
                  ),
                onLeave: (elements) =>
                  gsap.to(elements, { opacity: 0, scale: 0.92, duration: 0.3 }),
              });

              // 4. API call en parallele (sans bloquer l animation).
              try {
                const res = await fetch(`/api/offers/${uuid}/move-product`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ productId, toItemId }),
                });
                if (!res.ok) {
                  const json = await res.json().catch(() => ({}));
                  alert(json.error || 'Erreur déplacement');
                  loadData();
                }
              } catch {
                alert('Erreur réseau');
                loadData();
              }
            }}
          />
        </>
      )}
    </div>
  );
}
