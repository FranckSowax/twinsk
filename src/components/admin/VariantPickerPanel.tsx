'use client';

import { useState } from 'react';
import { Check, Layers, Minus, Square, CheckSquare } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import { pickQty, pickedTotalQty, setVariantPick, type VariantLike } from '@/lib/variant-picks';

export interface PickerVariant extends VariantLike {
  id: string;
  name: string;
}

interface VariantPickerPanelProps {
  resultId: string;
  variants: PickerVariant[];
  /** Repli produit (affiché en placeholder quand la variante n'a pas sa propre valeur). */
  product: {
    price: number | null;
    moq: number | null;
    weight: number | null;
    volume: number | null;
    dimensions: string | null;
    margin_percent: number;
  };
  /** Enregistre la liste de variantes (et la quantité produit = somme des retenues). */
  onCommit: (variants: PickerVariant[], totalQty: number) => void;
}

type NumField = 'price' | 'moq' | 'weight' | 'volume';

/**
 * Sélection multi-variantes d'un produit : cocher les variantes à retenir,
 * saisir leur quantité et compléter prix / poids / volume / dimensions pour
 * le devis et la packing list. Chaque variante retenue devient une ligne.
 */
export default function VariantPickerPanel({ resultId, variants, product, onCommit }: VariantPickerPanelProps) {
  const [draft, setDraft] = useState<PickerVariant[]>(variants);
  // Champs texte en cours de saisie (commit au blur), indexés par `${id}:${champ}`.
  const [editing, setEditing] = useState<Record<string, string>>({});
  // Resynchronise le brouillon quand le produit (ou ses variantes) change côté serveur.
  const [synced, setSynced] = useState<{ variants: PickerVariant[]; resultId: string }>({ variants, resultId });
  if (synced.variants !== variants || synced.resultId !== resultId) {
    setSynced({ variants, resultId });
    setDraft(variants);
    if (synced.resultId !== resultId) setEditing({});
  }

  const commit = (next: PickerVariant[]) => {
    setDraft(next);
    onCommit(next, pickedTotalQty(next));
  };

  const toggle = (v: PickerVariant) => {
    const current = pickQty(v);
    const defaultQty = Math.max(1, Number(v.moq) || Number(product.moq) || 1);
    commit(setVariantPick(draft, v.id, current > 0 ? 0 : defaultQty));
  };

  // Quantité : saisie locale, enregistrée au blur / Entrée (0 ou vide = variante retirée).
  const commitQty = (v: PickerVariant) => {
    const k = editKey(v.id, 'qty');
    if (!(k in editing)) return;
    const q = Math.max(0, Math.floor(Number(editing[k]) || 0));
    setEditing((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    if (q === pickQty(v)) return;
    commit(setVariantPick(draft, v.id, q));
  };

  const pickAll = () =>
    commit(
      draft.map((v) =>
        pickQty(v) > 0 ? v : { ...v, pick_qty: Math.max(1, Number(v.moq) || Number(product.moq) || 1) },
      ),
    );
  const pickNone = () =>
    commit(
      draft.map((v) => {
        const rest = { ...v };
        delete rest.pick_qty;
        return rest;
      }),
    );

  const editKey = (id: string, field: string) => `${id}:${field}`;
  const numValue = (v: PickerVariant, field: NumField) => {
    const k = editKey(v.id, field);
    if (k in editing) return editing[k];
    const n = v[field];
    return n == null ? '' : String(n);
  };
  const commitNum = (v: PickerVariant, field: NumField) => {
    const k = editKey(v.id, field);
    if (!(k in editing)) return;
    const raw = editing[k];
    const n = raw === '' ? null : Number(raw);
    const value = n != null && Number.isFinite(n) ? n : null;
    setEditing((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    if ((v[field] ?? null) === value) return;
    commit(draft.map((x) => (x.id === v.id ? { ...x, [field]: value } : x)));
  };
  const commitDims = (v: PickerVariant) => {
    const k = editKey(v.id, 'dimensions');
    if (!(k in editing)) return;
    const value = editing[k].trim() || null;
    setEditing((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    if ((v.dimensions ?? null) === value) return;
    commit(draft.map((x) => (x.id === v.id ? { ...x, dimensions: value } : x)));
  };

  const picked = draft.filter((v) => pickQty(v) > 0);
  const totalQty = pickedTotalQty(draft);
  const subtotal = picked.reduce((sum, v) => {
    const unit = v.price ?? product.price;
    return unit == null ? sum : sum + applyMargin(unit, product.margin_percent) * pickQty(v);
  }, 0);
  const missing = picked.filter((v) => (v.weight ?? product.weight) == null || (v.volume ?? product.volume) == null).length;

  const inputCls =
    'w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-center text-xs tabular-nums placeholder:text-slate-300 focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-800 dark:bg-indigo-900/10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <Layers className="h-3.5 w-3.5" />
          Variantes à retenir pour le devis
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300">
            {picked.length}/{draft.length}
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={pickAll}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-800 dark:text-indigo-300"
          >
            <CheckSquare className="h-3 w-3" /> Tout retenir
          </button>
          <button
            type="button"
            onClick={pickNone}
            disabled={!picked.length}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <Square className="h-3 w-3" /> Aucune
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
              <th className="w-8 px-1 py-1" />
              <th className="w-10 px-1 py-1">Photo</th>
              <th className="px-2 py-1">Variante</th>
              <th className="w-20 px-1 py-1 text-center">Qté</th>
              <th className="w-24 px-1 py-1 text-center">Prix ¥</th>
              <th className="w-16 px-1 py-1 text-center">MOQ</th>
              <th className="w-20 px-1 py-1 text-center">Poids kg</th>
              <th className="w-24 px-1 py-1 text-center">Vol. m³</th>
              <th className="w-28 px-1 py-1 text-center">Dimensions</th>
              <th className="w-24 px-1 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-100 dark:divide-indigo-900/40">
            {draft.map((v) => {
              const qty = pickQty(v);
              const on = qty > 0;
              const unit = v.price ?? product.price;
              const lineTotal = on && unit != null ? applyMargin(unit, product.margin_percent) * qty : null;
              return (
                <tr
                  key={v.id}
                  className={on ? 'bg-white text-slate-800 dark:bg-slate-800/60 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}
                >
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggle(v)}
                      title={on ? 'Retirer cette variante du devis' : 'Retenir cette variante'}
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                        on
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-slate-300 hover:border-indigo-400 dark:border-slate-600'
                      }`}
                    >
                      {on ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3 text-transparent" />}
                    </button>
                  </td>
                  <td className="px-1 py-1.5">
                    {v.image_url ? (
                      <div className="h-9 w-9 overflow-hidden rounded-md ring-1 ring-slate-200 dark:ring-slate-600">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={proxyImageUrl(v.image_url)} alt={v.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <p className={`font-semibold ${on ? '' : 'font-medium'}`}>{v.name}</p>
                    {v.capacity && <p className="text-[10px] text-slate-400">{v.capacity}</p>}
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      type="number"
                      min={0}
                      value={editKey(v.id, 'qty') in editing ? editing[editKey(v.id, 'qty')] : on ? qty : ''}
                      placeholder="0"
                      onChange={(e) => setEditing((prev) => ({ ...prev, [editKey(v.id, 'qty')]: e.target.value }))}
                      onBlur={() => commitQty(v)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className={`${inputCls} ${on ? 'font-bold text-indigo-700 dark:text-indigo-300' : ''}`}
                    />
                  </td>
                  {(['price', 'moq', 'weight', 'volume'] as NumField[]).map((field) => (
                    <td key={field} className="px-1 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={field === 'volume' ? 0.0001 : field === 'weight' ? 0.001 : field === 'price' ? 0.01 : 1}
                        value={numValue(v, field)}
                        placeholder={product[field] != null ? String(product[field]) : '—'}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [editKey(v.id, field)]: e.target.value }))}
                        onBlur={() => commitNum(v, field)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className={inputCls}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1.5">
                    <input
                      type="text"
                      value={editKey(v.id, 'dimensions') in editing ? editing[editKey(v.id, 'dimensions')] : v.dimensions ?? ''}
                      placeholder={product.dimensions || 'L×l×h cm'}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [editKey(v.id, 'dimensions')]: e.target.value }))}
                      onBlur={() => commitDims(v)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-1 py-1.5 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {lineTotal != null ? formatCNY(lineTotal) : on ? <span className="text-[10px] text-amber-600">prix ?</span> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-slate-500 dark:text-slate-400">
          {picked.length
            ? `${picked.length} variante(s) retenue(s) · ${totalQty} unité(s) → ${picked.length} ligne(s) sur le devis`
            : 'Aucune variante retenue : le devis affichera une seule ligne produit.'}
          {missing > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {missing} sans poids ou volume
            </span>
          )}
        </p>
        {picked.length > 0 && (
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Sous-total avec marge : <span className="text-amber-600 dark:text-amber-400">{formatCNY(subtotal)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
