'use client';

// Transport fractionné : pour chaque ligne du panier, combien d'unités partent
// en avion (le reste part en bateau). Partagé entre la page commande (client)
// et le panier client de l'admin. Le calcul se fait côté serveur : « Appliquer »
// enregistre la répartition et renvoie le coût de chaque part.

import { useState } from 'react';
import { Loader2, Plane, Ship } from 'lucide-react';
import { formatSettlement, type MixedTransport, type SettlementCurrency } from '@/lib/offer-pricing';

export interface SplitLine {
  id: string;
  title: string;
  variant_name?: string | null;
  quantity: number;
  air_qty?: number | null;
}

interface Props {
  lines: SplitLine[];
  /** Détail renvoyé par le serveur une fois la répartition appliquée. */
  mixed: MixedTransport | null | undefined;
  currency: SettlementCurrency;
  applied: boolean;
  busy: boolean;
  onApply: (split: Record<string, number>) => void | Promise<void>;
  compact?: boolean;
}

export default function TransportSplitEditor({ lines, mixed, currency, applied, busy, onApply, compact = false }: Props) {
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, Math.min(l.quantity, Math.max(0, Number(l.air_qty) || 0))])),
  );
  // Resynchronise si les lignes changent (ajout / retrait / quantité).
  const [seen, setSeen] = useState(lines);
  if (seen !== lines) {
    setSeen(lines);
    setDraft(Object.fromEntries(lines.map((l) => [l.id, Math.min(l.quantity, Math.max(0, Number(l.air_qty ?? draft[l.id]) || 0))])));
  }
  const fmt = (n: number | null | undefined) => formatSettlement(n, currency);
  const setAir = (id: string, qty: number, v: number) => setDraft((d) => ({ ...d, [id]: Math.min(qty, Math.max(0, Math.trunc(v) || 0)) }));
  const airUnits = lines.reduce((s, l) => s + (draft[l.id] || 0), 0);
  const seaUnits = lines.reduce((s, l) => s + l.quantity, 0) - airUnits;
  const dirty = lines.some((l) => (draft[l.id] || 0) !== Math.min(l.quantity, Math.max(0, Number(l.air_qty) || 0))) || !applied;
  const input = `${compact ? 'w-14' : 'w-16'} rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-sm font-semibold tabular-nums text-slate-900`;

  return (
    <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-slate-900">
      <p className="text-sm font-semibold text-slate-900">Répartir chaque produit entre l’avion et le bateau</p>
      <p className="text-xs text-slate-700">
        Indiquez le nombre d’unités qui partent <strong>en avion</strong> (8 à 14 jours) ; le reste part <strong>en bateau</strong> (60 à 85 jours).
      </p>
      <ul className="divide-y divide-violet-100">
        {lines.map((l) => {
          const air = draft[l.id] || 0;
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 basis-full text-sm text-slate-900 sm:flex-1 sm:basis-0">
                <span className="line-clamp-2 font-medium">{l.title}</span>
                {l.variant_name && <span className="block text-xs text-slate-500">{l.variant_name}</span>}
                <span className="block text-xs text-slate-500">{l.quantity} unité{l.quantity > 1 ? 's' : ''}</span>
              </span>
              <label className="flex items-center gap-1.5 text-xs text-slate-700">
                <Plane className="h-3.5 w-3.5 text-sky-600" />
                <input type="number" min={0} max={l.quantity} value={air} onChange={(e) => setAir(l.id, l.quantity, Number(e.target.value))} className={input} />
                avion
              </label>
              <span className="flex items-center gap-1.5 text-xs text-slate-700">
                <Ship className="h-3.5 w-3.5 text-blue-600" />
                <span className="w-8 text-center font-semibold tabular-nums text-slate-900">{l.quantity - air}</span>
                bateau
              </span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setAir(l.id, l.quantity, l.quantity)} className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50">tout avion</button>
                <button type="button" onClick={() => setAir(l.id, l.quantity, 0)} className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50">tout bateau</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-800">
          ✈️ {airUnits} unité{airUnits > 1 ? 's' : ''} en avion · 🚢 {seaUnits} unité{seaUnits > 1 ? 's' : ''} en bateau
        </p>
        <button
          type="button"
          onClick={() => onApply(draft)}
          disabled={busy || (!dirty && applied)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {applied && !dirty ? 'Répartition appliquée' : 'Calculer et appliquer'}
        </button>
      </div>
      {applied && mixed && (
        <div className="grid gap-2 rounded-xl border border-violet-100 bg-white p-3 text-sm text-slate-900 sm:grid-cols-2">
          <p className="text-slate-800">
            ✈️ Avion : {mixed.airUnits} unité{mixed.airUnits > 1 ? 's' : ''}
            {mixed.airWeight != null ? ` · ${mixed.airWeight.toFixed(2)} kg` : ''} — <strong>{mixed.airUnits ? fmt(mixed.airCost) : '—'}</strong>
            {mixed.airCostBattery ? <span className="block text-xs text-slate-500">dont batterie : {fmt(mixed.airCostBattery)}</span> : null}
          </p>
          <p className="text-slate-800">
            🚢 Bateau : {mixed.seaUnits} unité{mixed.seaUnits > 1 ? 's' : ''}
            {mixed.seaVolume != null ? ` · ${mixed.seaVolume.toFixed(4)} m³` : ''} — <strong>{mixed.seaUnits ? fmt(mixed.seaCost) : '—'}</strong>
          </p>
          <p className="font-semibold text-slate-900 sm:col-span-2">
            Transport total : {mixed.available ? fmt(mixed.cost) : mixed.seaOverLimit ? 'la part bateau dépasse 20 m³ : conteneur dédié sur devis, contactez-nous sur WhatsApp' : 'non chiffrable (poids ou volume manquant)'}
          </p>
        </div>
      )}
    </div>
  );
}
