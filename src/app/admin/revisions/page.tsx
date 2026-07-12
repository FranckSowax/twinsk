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
} from 'lucide-react';
import { useAdminT } from '@/components/admin/LocaleProvider';

interface ReviewLine {
  id: string;
  offer_id: string | null;
  offer_product_id: string | null;
  offer_title: string | null;
  title: string | null;
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
  collab_notes: string | null;
  admin_note: string | null;
  review_status: string;
  applied_at: string | null;
  created_at: string;
}

type TFn = (k: Parameters<ReturnType<typeof useAdminT>['t']>[0]) => string;

export default function RevisionsPage() {
  const { t } = useAdminT();
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
  onPatchLocal,
  onRemoveLocal,
}: {
  line: ReviewLine;
  isAdmin: boolean;
  t: TFn;
  onPatchLocal: (id: string, fields: Partial<ReviewLine>) => void;
  onRemoveLocal: (id: string) => void;
}) {
  const reviewed = line.review_status === 'reviewed';
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
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState<'review' | 'apply' | 'delete' | null>(null);

  const set = (k: keyof typeof draft, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  const buildPayload = () => ({
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

  const save = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`/api/collab-review/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onPatchLocal(line.id, payload);
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
      const payload = { ...buildPayload(), review_status: next };
      const res = await fetch(`/api/collab-review/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) onPatchLocal(line.id, { ...payload });
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
          </div>
          <p className="mt-1 truncate font-semibold text-slate-900 dark:text-white" title={line.title || ''}>{line.title || '—'}</p>
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

      {/* Champs à compléter */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numField(t('review.price'), 'price')}
        {numField(t('review.supplierShipping'), 'supplier_shipping_price')}
        {textField(t('review.deliveryTime'), 'delivery_time')}
        {numField(t('review.weight'), 'weight')}
        {numField(t('review.volume'), 'volume')}
        {textField(t('review.dimensions'), 'dimensions')}
        {numField(t('review.moq'), 'moq', '1')}
        <label className="flex items-center gap-2 self-end pb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={draft.has_battery} onChange={(e) => set('has_battery', e.target.checked)} className="h-4 w-4 rounded" />
          {t('review.battery')}
        </label>
      </div>
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
