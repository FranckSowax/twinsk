'use client';

// Bloc « Activité commerciale » du tableau de bord : chiffre d'affaires, marge
// produits et transport sur les commandes payées, avec trois graphiques SVG
// (aucune dépendance ajoutée). Tous les montants sont ramenés en FCFA.

import { useEffect, useState } from 'react';
import { BadgePercent, Coins, Loader2, Ship, ShoppingBag, TrendingUp } from 'lucide-react';

interface Bucket {
  key: string;
  label: string;
  revenue: number;
  margin: number;
  transport: number;
  orders: number;
}
interface Totals {
  revenue: number;
  cost: number;
  margin: number;
  marginRate: number;
  commission: number;
  transport: number;
  collected: number;
  orders: number;
  averageOrder: number;
}
interface Data {
  totals: Totals;
  engaged: Totals;
  monthly: Bucket[];
  listings: Bucket[];
  transport: Bucket[];
  lines_without_margin: number;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
/** Montants compacts pour les axes : 1 234 567 → « 1,2 M ». */
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')} M` : n >= 1000 ? `${Math.round(n / 1000)} k` : String(Math.round(n));
const pct = (n: number) => `${(n * 100).toFixed(1).replace('.0', '')} %`;

export default function BusinessKpis() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats/business?months=6')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Statistiques indisponibles'))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-10 dark:border-slate-700 dark:bg-slate-800">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const t = data.totals;
  const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800';
  const title = 'font-display text-lg uppercase tracking-tight text-slate-900 dark:text-white';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Activité commerciale</h2>
        <p className="text-xs text-slate-500">
          {t.orders} commande{t.orders > 1 ? 's' : ''} payée{t.orders > 1 ? 's' : ''}
          {data.engaged.orders > 0 && ` · ${data.engaged.orders} paiement(s) engagé(s) : ${fcfa(data.engaged.collected)} en attente`}
        </p>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Coins} tone="emerald" label="Encaissé" value={fcfa(t.collected)} sub={`${fcfa(t.revenue)} d’articles + ${fcfa(t.transport)} de transport`} />
        <Kpi icon={BadgePercent} tone="violet" label="Marge produits" value={fcfa(t.margin)} sub={`${pct(t.marginRate)} du CA articles · achat ${fcfa(t.cost)}`} />
        <Kpi icon={Ship} tone="blue" label="Transport facturé" value={fcfa(t.transport)} sub="refacturé au barème, hors marge" />
        <Kpi icon={ShoppingBag} tone="amber" label="Panier moyen" value={fcfa(t.averageOrder)} sub={t.commission > 0 ? `dont ${fcfa(t.commission)} de commission affiliés` : 'commandes payées'} />
      </div>

      {/* CA et marge par mois */}
      <div className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className={title}>Chiffre d’affaires et marge par mois</h3>
          <TrendingUp className="h-4 w-4 text-slate-400" />
        </div>
        <MonthlyChart data={data.monthly} />
        <Legend items={[{ color: '#10b981', label: 'CA articles' }, { color: '#8b5cf6', label: 'Marge produits' }, { color: '#60a5fa', label: 'Transport' }]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Listings */}
        <div className={card}>
          <h3 className={`${title} mb-4`}>Marge par listing</h3>
          {data.listings.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3">
              {data.listings.map((b) => (
                <BarRow key={b.key} label={b.label} value={b.margin} max={Math.max(...data.listings.map((x) => x.margin), 1)} hint={`${b.orders} commande(s) · CA ${fcfa(b.revenue)}`} color="#8b5cf6" />
              ))}
            </ul>
          )}
        </div>

        {/* Transport */}
        <div className={card}>
          <h3 className={`${title} mb-4`}>Transport choisi</h3>
          {data.transport.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3">
              {data.transport.map((b) => (
                <BarRow key={b.key} label={b.label} value={b.transport} max={Math.max(...data.transport.map((x) => x.transport), 1)} hint={`${b.orders} commande(s)`} color="#60a5fa" />
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Marge produits = prix affiché au client, remise déduite, moins le prix d’achat fournisseur (retrouvé à partir de la marge
        de chaque produit) et moins la commission des affiliés. Le transport est refacturé au barème : il est suivi à part et n’entre
        pas dans la marge.
        {data.lines_without_margin > 0 && ` ${data.lines_without_margin} ligne(s) dont le produit n’est plus au catalogue sont comptées sans marge.`}
      </p>
    </section>
  );
}

const TONES: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  violet: 'bg-violet-50 text-violet-600 ring-violet-200',
  blue: 'bg-blue-50 text-blue-600 ring-blue-200',
  amber: 'bg-amber-50 text-amber-600 ring-amber-200',
};

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: typeof Coins; tone: string; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${TONES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-slate-500">Aucune commande payée pour l’instant.</p>;
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

/** Barres groupées CA / marge / transport, en SVG (pas de dépendance). */
function MonthlyChart({ data }: { data: Bucket[] }) {
  const H = 160;
  const max = Math.max(...data.flatMap((b) => [b.revenue, b.margin, b.transport]), 1);
  const step = 100 / Math.max(1, data.length);
  const bar = step / 5; // 3 barres + marges, en pourcentage de largeur
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 100 ${H + 26}`} preserveAspectRatio="none" className="h-48 w-full min-w-[320px]" role="img" aria-label="Chiffre d’affaires et marge par mois">
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1="0" x2="100" y1={H - g * H} y2={H - g * H} stroke="currentColor" strokeWidth="0.2" className="text-slate-200 dark:text-slate-700" />
        ))}
        {data.map((b, i) => {
          const x = i * step + step / 2;
          const series = [
            { v: b.revenue, c: '#10b981', dx: -bar * 1.1 },
            { v: b.margin, c: '#8b5cf6', dx: 0 },
            { v: b.transport, c: '#60a5fa', dx: bar * 1.1 },
          ];
          return (
            <g key={b.key}>
              {series.map((s, k) => {
                const h = (s.v / max) * H;
                return <rect key={k} x={x + s.dx - bar / 2} y={H - h} width={bar} height={Math.max(h, s.v > 0 ? 0.6 : 0)} fill={s.c} rx="0.4" />;
              })}
              <text x={x} y={H + 10} textAnchor="middle" fontSize="4" fill="currentColor" className="text-slate-500">{b.label}</text>
              {b.revenue > 0 && (
                <text x={x} y={H + 20} textAnchor="middle" fontSize="3.6" fill="currentColor" className="text-slate-400">{compact(b.revenue)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarRow({ label, value, max, hint, color }: { label: string; value: number; max: number; hint: string; color: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium text-slate-800 dark:text-slate-100" title={label}>{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{fcfa(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: color }} />
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
    </li>
  );
}
