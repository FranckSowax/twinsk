'use client';

// Tableau de bord « Activité » (29 sept. 2026) : catalogue, WhatsApp (volume,
// temps de première réponse 24 h/24, heures de pointe, réponses par personne),
// entonnoir de vente, tableau par listing et sélections client, sur 7 / 30 /
// 90 jours ou tout. Graphiques SVG, sans dépendance. Données :
// /api/admin/stats/activity.

import { Fragment, useEffect, useState } from 'react';
import { Clock, Layers, Loader2, MessageCircle, Package, Sparkles, Store, Timer } from 'lucide-react';
import { PERIODS, type Period } from '@/lib/admin-activity';
import ConversationAnalysisSection from './ConversationAnalysisSection';

interface Bar { key: string; label: string; value: number }
interface Series { key: string; label: string; ad: number; direct: number; medianMinutes: number | null }
interface Data {
  period: Period;
  catalogue: {
    listings: number; b2b: number; b2c: number; products: number; newListings: number; listingsWithCart: number;
    topProducts: { id: string; title: string; products: number }[];
    publishedPerWeek: Bar[];
  };
  whatsapp: {
    conversations: number; fromAds: number; messagesIn: number; messagesOut: number;
    response: { requests: number; answered: number; unanswered: number; medianMinutes: number | null; meanMinutes: number | null; within15: number | null; within60: number | null };
    byPerson: { name: string; answered: number; medianMinutes: number | null }[];
    series: Series[];
    heatmap: number[][];
    unit: 'day' | 'week';
  };
  funnel: { key: string; label: string; value: number }[];
  listings: { key: string; label: string; listingId: string | null; conversations: number; fromAds: number; carts: number; transport: number; paid: number; revenue: number }[];
  selections: { sent: number; products: number; added: number };
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)} %`);
/** 31 → « 31 min », 247 → « 4 h 07 », 1 600 → « 1 j 3 h ». */
export function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    return `${h} h ${String(Math.round(min - h * 60)).padStart(2, '0')}`;
  }
  const d = Math.floor(min / 1440);
  return `${d} j ${Math.round((min - d * 1440) / 60)} h`;
}
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800';
const h3 = 'font-display text-lg uppercase tracking-tight text-slate-900 dark:text-white';

export default function ActivityDashboard() {
  const [period, setPeriod] = useState<Period>('30');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Changement de période : l'indicateur de chargement s'allume ici, pas dans l'effet.
  const choose = (p: Period) => {
    if (p === period) return;
    setLoading(true);
    setError('');
    setPeriod(p);
  };

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/stats/activity?period=${period}`)
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error || 'Statistiques indisponibles')))))
      .then((d: Data) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Activité</h2>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />}
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => choose(p.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === p.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
      {!data ? (
        !error && (
          <div className={`${card} flex justify-center py-10`}>
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        )
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <WhatsappBlock d={data} />
          <FunnelBlock d={data} />
          <ConversationAnalysisSection period={period} />
          <ListingsTable d={data} />
          <CatalogueBlock d={data} />
        </div>
      )}
    </section>
  );
}

// ---------- WhatsApp ----------
function WhatsappBlock({ d }: { d: Data }) {
  const w = d.whatsapp;
  const r = w.response;
  const adShare = w.conversations ? w.fromAds / w.conversations : null;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={MessageCircle} tone="emerald" label="Conversations reçues" value={String(w.conversations)} sub={`${pct(adShare)} venues des pubs · ${w.messagesIn} messages reçus, ${w.messagesOut} envoyés`} />
        <Kpi icon={Timer} tone="violet" label="1re réponse (médiane)" value={fmtDuration(r.medianMinutes)} sub={`moyenne ${fmtDuration(r.meanMinutes)} · 24 h/24`} />
        <Kpi icon={Clock} tone="blue" label="Répondu en moins d’1 h" value={pct(r.within60)} sub={`${pct(r.within15)} en moins de 15 min`} />
        <Kpi icon={MessageCircle} tone="amber" label="Demandes sans réponse" value={String(r.unanswered)} sub={`sur ${r.requests} demande(s) de la période`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className={`${h3} mb-4`}>Conversations par {w.unit === 'day' ? 'jour' : 'semaine'}</h3>
          <StackedBars data={w.series.map((s) => ({ key: s.key, label: s.label, a: s.ad, b: s.direct }))} colors={['#10b981', '#94a3b8']} />
          <Legend items={[{ color: '#10b981', label: 'Venues d’une pub' }, { color: '#94a3b8', label: 'Contact direct' }]} />
        </div>
        <div className={card}>
          <h3 className={`${h3} mb-4`}>Temps de 1re réponse (médiane)</h3>
          <StackedBars
            data={w.series.map((s) => ({ key: s.key, label: s.label, a: s.medianMinutes ?? 0, b: 0 }))}
            colors={['#8b5cf6', '#8b5cf6']}
            format={(v) => fmtDuration(v)}
          />
          <p className="mt-2 text-[11px] text-slate-500">Délai entre le premier message d’un client et la première réponse de l’équipe, nuits comprises.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} lg:col-span-2`}>
          <h3 className={`${h3} mb-1`}>Heures de pointe</h3>
          <p className="mb-3 text-xs text-slate-500">Messages reçus des clients par jour et par heure (heure locale).</p>
          <Heatmap grid={w.heatmap} />
        </div>
        <div className={card}>
          <h3 className={`${h3} mb-3`}>Réponses par personne</h3>
          {w.byPerson.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aucune réponse sur la période.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="pb-2 text-left font-semibold">Qui</th><th className="pb-2 text-right font-semibold">Réponses</th><th className="pb-2 text-right font-semibold">Médiane</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {w.byPerson.map((p) => (
                  <tr key={p.name}>
                    <td className="py-1.5 font-medium text-slate-800 dark:text-slate-100">{p.name === 'Téléphone' ? '📱 Téléphone' : p.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.answered}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtDuration(p.medianMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] text-slate-500">« Téléphone » : réponses envoyées directement depuis WhatsApp, hors messagerie.</p>
        </div>
      </div>
    </>
  );
}

// ---------- Entonnoir ----------
function FunnelBlock({ d }: { d: Data }) {
  const max = Math.max(...d.funnel.map((f) => f.value), 1);
  return (
    <div className={card}>
      <h3 className={`${h3} mb-4`}>Entonnoir de vente</h3>
      <ul className="space-y-2.5">
        {d.funnel.map((f, i) => {
          const prev = i > 0 ? d.funnel[i - 1].value : null;
          const rate = prev ? f.value / prev : null;
          return (
            <li key={f.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-100">{f.label}</span>
                <span className="shrink-0 tabular-nums">
                  <strong className="text-slate-900 dark:text-white">{f.value}</strong>
                  {rate != null && <span className={`ml-2 text-xs ${rate < 0.2 ? 'text-red-600' : 'text-slate-500'}`}>{Math.round(rate * 100)} % de l’étape précédente</span>}
                </span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.max(1.5, (f.value / max) * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500">
        Paniers : commandes créées sur la période avec un nom et un numéro de client. Une étape en rouge perd plus de 80 % des clients de l’étape précédente.
        {d.selections.sent > 0 && ` Sélections client envoyées : ${d.selections.sent} (${d.selections.products} produits, ${d.selections.added} ajoutés au panier).`}
      </p>
    </div>
  );
}

// ---------- Tableau par listing ----------
function ListingsTable({ d }: { d: Data }) {
  const rows = d.listings.slice(0, 25);
  return (
    <div className={card}>
      <h3 className={`${h3} mb-1`}>Par listing</h3>
      <p className="mb-3 text-xs text-slate-500">Conversation rattachée au listing dont le lien figure dans la pub d’origine (sinon au premier lien de listing échangé).</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Aucune activité sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="pb-2 text-left font-semibold">Listing</th>
                <th className="pb-2 text-right font-semibold">Conversations</th>
                <th className="pb-2 text-right font-semibold">Paniers</th>
                <th className="pb-2 text-right font-semibold">Conv. → panier</th>
                <th className="pb-2 text-right font-semibold">Transport choisi</th>
                <th className="pb-2 text-right font-semibold">Payés</th>
                <th className="pb-2 text-right font-semibold">Encaissé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((l) => (
                <tr key={l.key} className="text-slate-700 dark:text-slate-200">
                  <td className="max-w-[18rem] py-2 pr-2">
                    {l.listingId ? (
                      <a href={`/admin/offer/${l.listingId}`} className="line-clamp-1 font-medium text-slate-900 hover:underline dark:text-white" title={l.label}>{l.label}</a>
                    ) : (
                      <span className="line-clamp-1 italic text-slate-500" title={l.label}>{l.label}</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{l.conversations}{l.fromAds > 0 && <span className="ml-1 text-[10px] text-emerald-600">({l.fromAds} pub)</span>}</td>
                  <td className="py-2 text-right tabular-nums">{l.carts}</td>
                  <td className="py-2 text-right tabular-nums">{l.conversations ? pct(l.carts / l.conversations) : '—'}</td>
                  <td className="py-2 text-right tabular-nums">{l.transport}</td>
                  <td className="py-2 text-right tabular-nums">{l.paid}</td>
                  <td className="py-2 text-right tabular-nums">{l.revenue ? fcfa(l.revenue) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Catalogue ----------
function CatalogueBlock({ d }: { d: Data }) {
  const c = d.catalogue;
  const maxP = Math.max(...c.topProducts.map((t) => t.products), 1);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Store} tone="emerald" label="Listings publiés" value={String(c.listings)} sub={`${c.b2c} maison (B2C) · ${c.b2b} business (B2B)`} />
        <Kpi icon={Package} tone="blue" label="Produits publiés" value={c.products.toLocaleString('fr-FR')} sub={c.listings ? `${Math.round(c.products / c.listings)} en moyenne par listing` : '—'} />
        <Kpi icon={Sparkles} tone="violet" label="Nouveaux listings" value={String(c.newListings)} sub={d.period === 'all' ? 'depuis le début' : 'sur la période'} />
        <Kpi icon={Layers} tone="amber" label="Listings avec panier" value={String(c.listingsWithCart)} sub={`sur ${c.listings} publiés, paniers de la période`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className={`${h3} mb-4`}>Produits par listing (top 10)</h3>
          <ul className="space-y-3">
            {c.topProducts.map((t) => (
              <li key={t.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <a href={`/admin/offer/${t.id}`} className="truncate font-medium text-slate-800 hover:underline dark:text-slate-100" title={t.title}>{t.title}</a>
                  <span className="shrink-0 font-semibold tabular-nums">{t.products}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(2, (t.products / maxP) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h3 className={`${h3} mb-4`}>Listings publiés par semaine</h3>
          <StackedBars data={c.publishedPerWeek.map((b) => ({ key: b.key, label: b.label, a: b.value, b: 0 }))} colors={['#f59e0b', '#f59e0b']} />
        </div>
      </div>
    </>
  );
}

// ---------- Éléments graphiques ----------
const TONES: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  violet: 'bg-violet-50 text-violet-600 ring-violet-200',
  blue: 'bg-blue-50 text-blue-600 ring-blue-200',
  amber: 'bg-amber-50 text-amber-600 ring-amber-200',
};
function Kpi({ icon: Icon, tone, label, value, sub }: { icon: typeof Clock; tone: string; label: string; value: string; sub: string }) {
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

/** Barres empilées (a en bas, b au-dessus), étiquettes espacées si beaucoup de barres. */
function StackedBars({ data, colors, format }: { data: { key: string; label: string; a: number; b: number }[]; colors: [string, string]; format?: (v: number) => string }) {
  const H = 120;
  const max = Math.max(...data.map((x) => x.a + x.b), 1);
  const step = 100 / Math.max(1, data.length);
  const w = Math.max(0.6, step * 0.7);
  const every = Math.ceil(data.length / 8);
  const peak = data.reduce((m, x) => (x.a + x.b > m.a + m.b ? x : m), data[0]);
  return (
    <div>
      <svg viewBox={`0 0 100 ${H + 12}`} preserveAspectRatio="none" className="h-40 w-full" role="img">
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1="0" x2="100" y1={H - g * H} y2={H - g * H} stroke="currentColor" strokeWidth="0.2" className="text-slate-200 dark:text-slate-700" />
        ))}
        {data.map((x, i) => {
          const ha = (x.a / max) * H;
          const hb = (x.b / max) * H;
          const cx = i * step + (step - w) / 2;
          return (
            <g key={x.key}>
              <title>{`${x.label} : ${format ? format(x.a + x.b) : x.a + x.b}`}</title>
              <rect x={cx} y={H - ha} width={w} height={ha} fill={colors[0]} rx="0.3" />
              {x.b > 0 && <rect x={cx} y={H - ha - hb} width={w} height={hb} fill={colors[1]} rx="0.3" />}
              {i % every === 0 && (
                <text x={cx + w / 2} y={H + 9} textAnchor="middle" fontSize="3.4" fill="currentColor" className="text-slate-500">{x.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {peak && peak.a + peak.b > 0 && (
        <p className="mt-1 text-[11px] text-slate-500">Pic : {peak.label} ({format ? format(peak.a + peak.b) : peak.a + peak.b})</p>
      )}
    </div>
  );
}

function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(...grid.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))' }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[9px] text-slate-400">{h % 3 === 0 ? `${h}h` : ''}</span>
        ))}
        {grid.map((row, d) => (
          <Fragment key={d}>
            <span className="self-center text-[10px] font-semibold text-slate-500">{DAYS[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                title={`${DAYS[d]} ${h}h–${h + 1}h : ${v} message(s)`}
                className="aspect-square rounded-[3px]"
                style={{ background: v ? `rgba(16, 185, 129, ${0.12 + 0.88 * (v / max)})` : 'rgba(148, 163, 184, 0.12)' }}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
