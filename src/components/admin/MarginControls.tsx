'use client';

// Marge globale d'un listing ou d'une demande sur devis : la dernière marge
// appliquée à tous les produits est ENREGISTRÉE (historique price_history) et
// reproposée à la réouverture. Bouton « Historique » : tous les changements de
// marge et de prix, par produit ou pour tout le listing, avec auteur et date.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { History, Loader2, Percent } from 'lucide-react';
import { formatCNY } from '@/lib/utils/formatCurrency';
import type { PriceHistoryRow, PriceScope } from '@/lib/price-history';

interface MarginControlsProps {
  onApplyGlobal: (margin: number) => void | Promise<void>;
  /** Listing (offer) ou demande sur devis (request) : active l'enregistrement et l'historique. */
  scope?: PriceScope;
  targetId?: string;
}

interface HistoryData {
  rows: PriceHistoryRow[];
  lastGlobal: { value: number; at: string; actor: string | null } | null;
  available: boolean;
}

const DEFAULT_MARGIN = 30;
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtValue = (r: PriceHistoryRow, v: number | null) => (v === null ? '—' : r.field === 'margin_percent' || r.field === 'global_margin' ? `${v} %` : formatCNY(v));
const FIELD_LABEL: Record<string, string> = { margin_percent: 'Marge', price: 'Prix', variant_price: 'Prix variante', global_margin: 'Marge globale' };

export default function MarginControls({ onApplyGlobal, scope, targetId }: MarginControlsProps) {
  const [globalMargin, setGlobalMargin] = useState(DEFAULT_MARGIN);
  const [data, setData] = useState<HistoryData | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!scope || !targetId) return null;
    const r = await fetch(`/api/price-history?scope=${scope}&target=${targetId}`);
    if (!r.ok) return null;
    const d = (await r.json()) as HistoryData;
    setData(d);
    return d;
  }, [scope, targetId]);

  // À l'ouverture : la marge enregistrée remplace la valeur par défaut.
  useEffect(() => {
    load().then((d) => {
      if (d?.lastGlobal) setGlobalMargin(d.lastGlobal.value);
    });
  }, [load]);

  const apply = async () => {
    setApplying(true);
    try {
      await onApplyGlobal(globalMargin);
      await load();
    } finally {
      setApplying(false);
    }
  };

  // Changements groupés (même opération sur plusieurs produits) affichés en une ligne.
  const entries = useMemo(() => {
    const out: { key: string; rows: PriceHistoryRow[] }[] = [];
    const seen = new Map<string, number>();
    // Une marge globale résume les marges produit du même lot : une seule ligne.
    const globalBatches = new Set((data?.rows || []).filter((r) => r.field === 'global_margin' && r.batch_id).map((r) => r.batch_id));
    for (const r of data?.rows || []) {
      if (r.field === 'margin_percent' && r.batch_id && globalBatches.has(r.batch_id)) continue;
      const k = r.batch_id ? `${r.batch_id}:${r.field}` : r.id;
      const i = seen.get(k);
      if (i === undefined) {
        seen.set(k, out.length);
        out.push({ key: k, rows: [r] });
      } else out[i].rows.push(r);
    }
    return out;
  }, [data]);

  const last = data?.lastGlobal;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center gap-4">
        <Percent className="h-5 w-5 text-amber-500" />
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Marge globale :</label>
          <input
            type="number"
            min={0}
            step={5}
            value={globalMargin}
            onChange={(e) => setGlobalMargin(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-sm font-medium dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <span className="text-sm text-slate-500">%</span>
        </div>
        <motion.button
          type="button"
          onClick={apply}
          disabled={applying}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Appliquer à tous
        </motion.button>
        {scope && targetId && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              if (!open) load();
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${open ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300'}`}
          >
            <History className="h-4 w-4" /> Historique{data?.rows.length ? ` (${entries.length})` : ''}
          </button>
        )}
        {last && (
          <span className="text-xs text-slate-500">
            Marge enregistrée : <strong className="text-slate-700 dark:text-slate-200">{last.value} %</strong> · appliquée le {fmtDate(last.at)}
            {last.actor ? ` par ${last.actor}` : ''}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 max-h-80 overflow-y-auto border-t border-slate-100 pt-3 dark:border-slate-700">
          {!data ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
          ) : !data.available ? (
            <p className="text-sm text-amber-700">Historique indisponible : migration « price_history » pas encore appliquée.</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun changement de marge ou de prix enregistré pour l’instant.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1 pr-2 font-semibold">Date</th>
                  <th className="py-1 pr-2 font-semibold">Par</th>
                  <th className="py-1 pr-2 font-semibold">Produit</th>
                  <th className="py-1 pr-2 font-semibold">Changement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {entries.map(({ key, rows }) => {
                  const r = rows[0];
                  const isGlobal = r.field === 'global_margin';
                  const group = isGlobal || rows.length > 1 || (r.batch_size ?? 0) > 1;
                  const count = isGlobal ? r.batch_size ?? 0 : rows.length;
                  const olds = Array.from(new Set(rows.map((x) => fmtValue(x, x.old_value))));
                  const news = Array.from(new Set(rows.map((x) => fmtValue(x, x.new_value))));
                  return (
                    <tr key={key} className="align-top text-slate-700 dark:text-slate-200">
                      <td className="whitespace-nowrap py-1.5 pr-2 text-slate-500">{fmtDate(r.created_at)}</td>
                      <td className="py-1.5 pr-2">{r.actor || '—'}</td>
                      <td className="py-1.5 pr-2">
                        {group ? (
                          <span className="font-semibold text-amber-700">{isGlobal ? 'Tout le listing' : 'Plusieurs produits'}{count ? ` (${count} produit${count > 1 ? 's' : ''})` : ''}</span>
                        ) : (
                          <span className="line-clamp-2" title={r.product_title || ''}>
                            {r.product_title || 'Produit'}
                            {r.variant_name ? <span className="text-slate-400"> · {r.variant_name}</span> : null}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-2">
                        <span className="text-slate-500">{FIELD_LABEL[r.field] || r.field} :</span>{' '}
                        <span className="text-slate-400 line-through">{olds.length > 2 ? 'variable' : olds.join(' / ')}</span> →{' '}
                        <strong>{news.length > 2 ? 'variable' : news.join(' / ')}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
