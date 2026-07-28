'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  ClipboardCheck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Save,
  RotateCcw,
  Send,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useAdminT } from '@/components/admin/LocaleProvider';
import ShareFicheButton from '@/components/admin/ShareFicheButton';
import { mergeVariantFills } from '@/lib/review-variants';

interface ReviewVariant {
  name?: string | null;
  capacity?: string | null;
  price?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
  image_url?: string | null;
}

interface ReviewLine {
  id: string;
  offer_id: string | null;
  offer_product_id: string | null;
  offer_title: string | null;
  title: string | null;
  title_original: string | null;
  image_url: string | null;
  product_url: string | null;
  seller: string | null;
  price: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  supplier_shipping_price: number | null;
  delivery_time: string | null;
  has_battery: boolean | null;
  moq: number | null;
  variants: ReviewVariant[] | null;
  collab_notes: string | null;
  admin_note: string | null;
  review_status: string;
  applied_at: string | null;
  vendor_filled_at: string | null;
  created_at: string;
}

type TFn = (k: Parameters<ReturnType<typeof useAdminT>['t']>[0]) => string;

export default function RevisionsPage() {
  const { t, locale } = useAdminT();
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyPending, setOnlyPending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collab-review${onlyPending ? '?status=pending' : ''}`);
      const data = await res.json();
      if (Array.isArray(data.lines)) setLines(data.lines);
    } finally {
      setLoading(false);
    }
  }, [onlyPending]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(d?.role === 'admin'))
      .catch(() => {});
  }, []);

  const patchLocal = (id: string, fields: Partial<ReviewLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...fields } : l)));

  const removeLocal = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <ClipboardCheck className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{t('review.title')}</h1>
          <p className="text-sm text-slate-500">{t('review.subtitle')}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="h-4 w-4 rounded" />
        {t('review.filterPending')}
      </label>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> …
        </div>
      ) : lines.length === 0 ? (
        <p className="py-6 text-sm text-slate-400">{t('review.empty')}</p>
      ) : (
        <div className="space-y-4">
          {lines.map((l) => (
            <ReviewCard
              key={l.id}
              line={l}
              isAdmin={isAdmin}
              t={t as TFn}
              locale={locale}
              onPatchLocal={patchLocal}
              onRemoveLocal={removeLocal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ReviewCard({
  line,
  isAdmin,
  t,
  locale,
  onPatchLocal,
  onRemoveLocal,
}: {
  line: ReviewLine;
  isAdmin: boolean;
  t: TFn;
  locale: string;
  onPatchLocal: (id: string, fields: Partial<ReviewLine>) => void;
  onRemoveLocal: (id: string) => void;
}) {
  const reviewed = line.review_status === 'reviewed';
  const variants = Array.isArray(line.variants) ? line.variants : [];
  const hasVariants = variants.length > 0;

  const [draft, setDraft] = useState({
    price: line.price?.toString() ?? '',
    weight: line.weight?.toString() ?? '',
    volume: line.volume?.toString() ?? '',
    dimensions: line.dimensions ?? '',
    supplier_shipping_price: line.supplier_shipping_price?.toString() ?? '',
    delivery_time: line.delivery_time ?? '',
    has_battery: !!line.has_battery,
    moq: line.moq?.toString() ?? '',
    collab_notes: line.collab_notes ?? '',
  });
  // Champs à remplir PAR VARIANTE (poids/volume/dimensions).
  const [vars, setVars] = useState(
    variants.map((v) => ({
      weight: v.weight != null ? String(v.weight) : '',
      volume: v.volume != null ? String(v.volume) : '',
      dimensions: v.dimensions ?? '',
    })),
  );
  const [variantsOpen, setVariantsOpen] = useState(false);
  const setVar = (i: number, k: 'weight' | 'volume' | 'dimensions', val: string) =>
    setVars((prev) => prev.map((v, idx) => (idx === i ? { ...v, [k]: val } : v)));
  const filledVariants = vars.filter((v) => v.weight.trim() || v.volume.trim() || v.dimensions.trim()).length;

  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState<'review' | 'apply' | 'delete' | null>(null);

  const set = (k: keyof typeof draft, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  // Champs produit (compatibles Partial<ReviewLine> pour la maj optimiste locale).
  const buildFields = () => ({
    price: numOrNull(draft.price),
    weight: numOrNull(draft.weight),
    volume: numOrNull(draft.volume),
    dimensions: draft.dimensions.trim() || null,
    supplier_shipping_price: numOrNull(draft.supplier_shipping_price),
    delivery_time: draft.delivery_time.trim() || null,
    has_battery: draft.has_battery,
    moq: draft.moq.trim() === '' ? null : Math.trunc(Number(draft.moq)) || null,
    collab_notes: draft.collab_notes.trim() || null,
  });
  // Fills variantes envoyés à l'API (fusionnés par index côté serveur).
  const variantFills = () =>
    vars.map((v, index) => ({ index, weight: v.weight, volume: v.volume, dimensions: v.dimensions }));

  // Envoie les champs produit + (si variantes) les fills variantes, et met à jour
  // l'état local (produit + variantes fusionnées localement pour rester cohérent).
  const persist = async (extra?: Record<string, unknown>) => {
    const fields = buildFields();
    const body: Record<string, unknown> = { ...fields, ...extra };
    if (hasVariants) body.variants = variantFills();
    const res = await fetch(`/api/collab-review/${line.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const localPatch: Partial<ReviewLine> = { ...fields, ...(extra as Partial<ReviewLine>) };
    if (hasVariants) {
      localPatch.variants = mergeVariantFills(
        variants as unknown as Record<string, unknown>[],
        variantFills(),
      ) as unknown as ReviewVariant[];
    }
    onPatchLocal(line.id, localPatch);
    return true;
  };

  const save = async () => {
    setSaving(true);
    try {
      if (await persist()) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleReviewed = async () => {
    setBusy('review');
    try {
      // Enregistre aussi les infos courantes en passant révisée.
      const next = reviewed ? 'pending' : 'reviewed';
      await persist({ review_status: next });
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy('apply');
    try {
      const res = await fetch(`/api/collab-review/${line.id}/apply`, { method: 'POST' });
      if (res.ok) onPatchLocal(line.id, { applied_at: new Date().toISOString() });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm('Retirer cette ligne ?')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/collab-review/${line.id}`, { method: 'DELETE' });
      if (res.ok) onRemoveLocal(line.id);
    } finally {
      setBusy(null);
    }
  };

  const numField = (label: string, k: 'price' | 'weight' | 'volume' | 'supplier_shipping_price' | 'moq', step = 'any') => (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <input
        type="number"
        step={step}
        value={draft[k]}
        onChange={(e) => set(k, e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  );
  const textField = (label: string, k: 'dimensions' | 'delivery_time') => (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <input
        type="text"
        value={draft[k]}
        onChange={(e) => set(k, e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  );

  return (
    <div
      className={`rounded-3xl border-2 p-5 transition-colors ${
        reviewed
          ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/15'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      {/* En-tête ligne */}
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
          {line.image_url ? (
            <Image src={line.image_url} alt={line.title || ''} fill className="object-cover" sizes="64px" unoptimized />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                reviewed ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {reviewed ? <CheckCircle2 className="h-3 w-3" /> : <Send className="h-3 w-3" />}
              {reviewed ? t('review.reviewed') : t('review.pending')}
            </span>
            {line.applied_at && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{t('review.applied')}</span>
            )}
            {line.vendor_filled_at && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">✅ 供应商已填 · Vendeur a répondu</span>
            )}
          </div>
          {(() => {
            // En chinois, on affiche le titre original 1688 (celui que le fournisseur
            // reconnaît). L'autre langue reste en sous-titre discret pour référence.
            const zh = locale === 'zh';
            const primary = zh ? line.title_original || line.title : line.title;
            const secondary = zh ? (line.title_original ? line.title : null) : line.title_original;
            return (
              <>
                <p className="mt-1 truncate font-semibold text-slate-900 dark:text-white" title={primary || ''}>
                  {primary || '—'}
                </p>
                {secondary && (
                  <p className="truncate text-xs text-slate-400" title={secondary}>
                    {secondary}
                  </p>
                )}
              </>
            );
          })()}
          <p className="text-xs text-slate-400">
            {t('review.offer')}: {line.offer_title || '—'}
            {line.seller ? ` · ${line.seller}` : ''}
          </p>
          {line.product_url && (
            <a
              href={line.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> {t('review.contactSeller')}
            </a>
          )}
        </div>
      </div>

      {line.admin_note && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          <span className="font-semibold">{t('review.adminNote')}: </span>
          {line.admin_note}
        </p>
      )}

      {/* Champs à compléter (produit).
          Poids/volume/dimensions sont PAR VARIANTE quand le produit a des variantes. */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numField(t('review.price'), 'price')}
        {numField(t('review.supplierShipping'), 'supplier_shipping_price')}
        {textField(t('review.deliveryTime'), 'delivery_time')}
        {!hasVariants && numField(t('review.weight'), 'weight')}
        {!hasVariants && numField(t('review.volume'), 'volume')}
        {!hasVariants && textField(t('review.dimensions'), 'dimensions')}
        {numField(t('review.moq'), 'moq', '1')}
        <label className="flex items-center gap-2 self-end pb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={draft.has_battery} onChange={(e) => set('has_battery', e.target.checked)} className="h-4 w-4 rounded" />
          {t('review.battery')}
        </label>
      </div>

      {/* Variantes : dropdown déroulant, mêmes champs (poids/volume/dimensions) pour chacune */}
      {hasVariants && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setVariantsOpen((o) => !o)}
            className="flex w-full items-center gap-2 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
          >
            <Layers className="h-4 w-4 text-emerald-500" />
            <span className="flex-1">
              {variants.length} variante{variants.length > 1 ? 's' : ''}
              <span className="ml-1.5 font-normal text-slate-400">— renseigner poids/volume/dimensions de chacune</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${filledVariants === variants.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {filledVariants}/{variants.length}
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${variantsOpen ? 'rotate-180' : ''}`} />
          </button>
          {variantsOpen && (
            <div className="space-y-2 p-3">
              {variants.map((v, i) => {
                const filled = !!(vars[i]?.weight.trim() || vars[i]?.volume.trim() || vars[i]?.dimensions.trim());
                return (
                  <div key={i} className={`rounded-xl border p-3 ${filled ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                    <div className="mb-2 flex items-center gap-2">
                      {v.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                      )}
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        <span className="text-slate-400">{i + 1}.</span> {v.name || `Variante ${i + 1}`}
                        {v.capacity ? <span className="ml-1 text-xs font-normal text-slate-400">· {v.capacity}</span> : null}
                      </p>
                      {filled && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
                        {t('review.weight')}
                        <input type="number" step="any" value={vars[i]?.weight ?? ''} onChange={(e) => setVar(i, 'weight', e.target.value)} placeholder="kg"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
                        {t('review.volume')}
                        <input type="number" step="any" value={vars[i]?.volume ?? ''} onChange={(e) => setVar(i, 'volume', e.target.value)} placeholder="m³"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
                        {t('review.dimensions')}
                        <input type="text" value={vars[i]?.dimensions ?? ''} onChange={(e) => setVar(i, 'dimensions', e.target.value)} placeholder="L×l×h"
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-500">
        {t('review.notes')}
        <textarea
          rows={2}
          value={draft.collab_notes}
          onChange={(e) => set('collab_notes', e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {savedFlash ? t('review.saved') : t('review.save')}
        </button>
        <button
          onClick={toggleReviewed}
          disabled={busy === 'review'}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
            reviewed ? 'bg-slate-500 hover:bg-slate-600' : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {busy === 'review' ? <Loader2 className="h-4 w-4 animate-spin" /> : reviewed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {reviewed ? t('review.reopen') : t('review.markReviewed')}
        </button>

        {/* Partager la fiche vierge au vendeur (WeChat / WhatsApp) */}
        <ShareFicheButton id={line.id} />

        {isAdmin && (
          <>
            {reviewed && line.offer_product_id && (
              <button
                onClick={apply}
                disabled={busy === 'apply'}
                className="flex items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('review.apply')}
              </button>
            )}
            <button
              onClick={remove}
              disabled={busy === 'delete'}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('review.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
