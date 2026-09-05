'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Flame, Loader2, Save, Search, X } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import { BEST_SELLERS_MAX, type BestSellers } from '@/lib/best-sellers';

export interface BestSellerCandidate {
  id: string;
  title: string;
  image_url: string;
  category: string | null;
}

/**
 * Galerie « Best sellers » (listings B2B) : l'admin choisit jusqu'à 12 produits
 * du listing, les ordonne, active la galerie ; elle s'affiche en tête de la
 * page publique avec un cadre rouge animé sur chaque carte.
 */
export default function BestSellersPanel({
  offerId,
  value,
  products,
  onSaved,
}: {
  offerId: string;
  value: BestSellers;
  products: BestSellerCandidate[];
  onSaved: (v: BestSellers) => void;
}) {
  const [open, setOpen] = useState(true);
  const [enabled, setEnabled] = useState(value.enabled);
  const [ids, setIds] = useState<string[]>(value.product_ids);
  const [title, setTitle] = useState(value.title || '');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selected = ids.map((id) => byId.get(id)).filter((p): p is BestSellerCandidate => !!p);
  const full = ids.length >= BEST_SELLERS_MAX;
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !ids.includes(p.id))
      .filter((p) => !q || `${p.title} ${p.category || ''}`.toLowerCase().includes(q))
      .slice(0, 36);
  }, [products, ids, query]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    setIds((prev) => {
      const n = [...prev];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const body: BestSellers = { enabled: enabled && ids.length > 0, product_ids: ids, title: title.trim() || null };
      const res = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ best_sellers: body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onSaved(body);
      setMsg({ ok: true, text: body.enabled ? `Galerie activée (${ids.length} produit${ids.length > 1 ? 's' : ''}).` : 'Galerie enregistrée, désactivée.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-4 dark:border-red-900/50 dark:bg-slate-800">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <Flame className="h-5 w-5 text-red-500" />
        <span className="font-semibold text-slate-900 dark:text-white">Best sellers</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${value.enabled ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
          {value.enabled ? 'activée' : 'désactivée'}
        </span>
        <span className="text-xs text-slate-500">{ids.length} / {BEST_SELLERS_MAX} · galerie horizontale en tête du listing</span>
        {open ? <ChevronDown className="ml-auto h-4 w-4 text-slate-400" /> : <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-red-600" />
              Afficher la galerie en tête de la page publique
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="Titre (défaut : Nos meilleures ventes)"
              className="min-w-[16rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          {/* Sélection ordonnée (aperçu de la galerie) */}
          {selected.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Aucun produit choisi. Cliquez sur un produit ci-dessous pour l&apos;ajouter (12 max).
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selected.map((p, i) => (
                <div key={p.id} className="best-seller-card relative w-36 flex-shrink-0 overflow-hidden">
                  <div className="relative aspect-square bg-slate-100">
                    <SmartImage src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white">#{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setIds((prev) => prev.filter((x) => x !== p.id))}
                      title="Retirer"
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="line-clamp-2 px-2 pt-1.5 text-[11px] font-medium text-slate-800" title={p.title}>{p.title}</p>
                  <div className="flex justify-between px-1 pb-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Avancer"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Reculer"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Candidats */}
          <div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={full ? 'Galerie complète (12 / 12) — retirez un produit pour en ajouter un autre' : 'Chercher un produit du listing à ajouter…'}
                disabled={full}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            {!full && (
              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
                {candidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setIds((prev) => (prev.length < BEST_SELLERS_MAX ? [...prev, p.id] : prev))}
                    title={`${p.title}${p.category ? ` · ${p.category}` : ''}`}
                    className="group overflow-hidden rounded-xl border border-slate-200 text-left transition hover:border-red-400 dark:border-slate-600"
                  >
                    <div className="aspect-square bg-slate-100">
                      <SmartImage src={p.image_url} alt={p.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <p className="line-clamp-2 px-1.5 py-1 text-[11px] text-slate-700 dark:text-slate-200">{p.title}</p>
                  </button>
                ))}
                {candidates.length === 0 && (
                  <p className="col-span-full py-4 text-center text-xs text-slate-500">Aucun produit visible ne correspond.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer la galerie
            </button>
            {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
