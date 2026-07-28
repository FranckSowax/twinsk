'use client';

// Dashboard agents Gabon — sidebar (desktop), KPIs, table pro (desktop) / cartes (mobile).
// Une seule requête (filter=all) : onglets, KPIs et recherche sont dérivés côté client.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  HandCoins,
  HandHeart,
  LayoutList,
  Loader2,
  LogOut,
  Package,
  PackageSearch,
  Plane,
  RefreshCw,
  Search,
} from 'lucide-react';
import AgentOrderDetail from './AgentOrderDetail';
import {
  fmtFcfa,
  fmtDate,
  stageOf,
  stageIdx,
  StageChip,
  IconTag,
  PipelineStrip,
  PAY_META,
  PAY_FALLBACK,
  TRANSPORT_META,
  TRANSPORT_FALLBACK,
} from './agent-ui';

type Agent = { id: string; name: string };
type Row = {
  id: string;
  order_number: string;
  client_name: string | null;
  client_phone: string | null;
  grand_total_fcfa: number | null;
  items_total_fcfa: number | null;
  payment_method: string | null;
  payment_status: string;
  order_status: string | null;
  transport_mode: string | null;
  created_at: string;
  thumbnail: string | null;
  items_count: number;
};

const TABS = [
  { key: 'to_collect', label: 'À encaisser', icon: HandCoins },
  { key: 'to_ship', label: 'À expédier', icon: Plane },
  { key: 'to_receive', label: 'À réceptionner', icon: PackageSearch },
  { key: 'to_deliver', label: 'À remettre', icon: HandHeart },
  { key: 'delivered', label: 'Remises', icon: CheckCircle2 },
  { key: 'all', label: 'Toutes', icon: LayoutList },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const EMPTY_COPY: Record<TabKey, string> = {
  to_collect: 'Rien à encaisser. Tout est à jour.',
  to_ship: 'Aucune commande payée en attente d’expédition.',
  to_receive: 'Aucun colis en route vers l’agence.',
  to_deliver: 'Aucun colis à remettre.',
  delivered: 'Aucune commande remise pour le moment.',
  all: 'Aucune commande pour le moment.',
};

const total = (o: Row) => o.grand_total_fcfa ?? o.items_total_fcfa;

function inTab(tab: TabKey, o: Row): boolean {
  switch (tab) {
    case 'to_collect':
      return o.payment_status !== 'paid';
    case 'to_ship':
      return o.payment_status === 'paid' && o.order_status === 'paid';
    case 'to_receive':
      return o.order_status === 'shipped';
    case 'to_deliver':
      return o.order_status === 'at_agency';
    case 'delivered':
      return o.order_status === 'delivered';
    default:
      return true;
  }
}

// Prochaine action possible sur la commande (bouton rapide de la table).
function nextStep(o: Row): { path: string; label: string; cls: string; confirm?: string } | null {
  if (o.payment_status !== 'paid') {
    if (o.payment_status === 'submitted' && o.payment_method && o.payment_method !== 'cash') {
      return {
        path: 'validate-payment',
        label: 'Valider',
        cls: 'bg-emerald-500 hover:bg-emerald-600',
        confirm: `Valider le paiement ${o.payment_method} de ${fmtFcfa(total(o))} ?`,
      };
    }
    return {
      path: 'collect-cash',
      label: 'Encaisser',
      cls: 'bg-amber-500 hover:bg-amber-600',
      confirm: `Encaisser ${fmtFcfa(total(o))} en espèces ?`,
    };
  }
  if (o.order_status === 'paid') return { path: 'ship', label: 'Expédier', cls: 'bg-sky-500 hover:bg-sky-600' };
  if (o.order_status === 'shipped') return { path: 'receive', label: 'Réceptionner', cls: 'bg-teal-500 hover:bg-teal-600' };
  if (o.order_status === 'at_agency')
    return { path: 'deliver', label: 'Remettre', cls: 'bg-violet-500 hover:bg-violet-600', confirm: 'Remettre la commande au client ?' };
  return null;
}

export default function AgentOrders({ agent, onLogout }: { agent: Agent; onLogout: () => void }) {
  const [tab, setTab] = useState<TabKey>('to_collect');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/agent/orders?filter=all');
      const j = await r.json();
      setRows(j.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TABS) c[t.key] = rows.filter((o) => inTab(t.key, o)).length;
    return c;
  }, [rows]);

  const toCollectAmount = useMemo(
    () => rows.filter((o) => inTab('to_collect', o)).reduce((s, o) => s + (total(o) || 0), 0),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((o) => inTab(tab, o))
      .filter(
        (o) =>
          !q ||
          o.order_number.toLowerCase().includes(q) ||
          (o.client_name || '').toLowerCase().includes(q) ||
          (o.client_phone || '').includes(q),
      );
  }, [rows, tab, query]);

  const quickAct = async (o: Row, e: React.MouseEvent) => {
    e.stopPropagation();
    const step = nextStep(o);
    if (!step || busyId) return;
    if (step.confirm && !window.confirm(step.confirm)) return;
    setBusyId(o.id);
    try {
      const r = await fetch(`/api/agent/orders/${o.id}/${step.path}`, { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        window.alert(j.error || 'Erreur');
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (openId) {
    return (
      <AgentOrderDetail
        id={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  const kpis = [
    { label: 'À encaisser', value: String(counts.to_collect), sub: fmtFcfa(toCollectAmount), icon: HandCoins, box: 'bg-amber-50 text-amber-600 ring-amber-200' },
    { label: 'À expédier', value: String(counts.to_ship), sub: 'payées, départ Chine', icon: Plane, box: 'bg-sky-50 text-sky-600 ring-sky-200' },
    { label: 'En route / agence', value: `${counts.to_receive + counts.to_deliver}`, sub: `${counts.to_deliver} à remettre`, icon: Building2, box: 'bg-teal-50 text-teal-600 ring-teal-200' },
    { label: 'Remises', value: String(counts.delivered), sub: 'commandes terminées', icon: HandHeart, box: 'bg-violet-50 text-violet-600 ring-violet-200' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col bg-slate-900 text-slate-300 lg:flex">
        <div className="px-5 py-6">
          <p className="font-display text-lg font-bold tracking-tight text-white">TWINSK</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Agents Gabon</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-emerald-500/15 text-emerald-300' : 'hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{t.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    active ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">
              {agent.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
              <p className="text-[11px] text-slate-400">Agent</p>
            </div>
            <button onClick={onLogout} title="Se déconnecter" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu */}
      <div className="min-w-0 flex-1">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="lg:hidden">
              <p className="font-display text-sm font-bold leading-tight text-slate-900">TWINSK</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600">Agents</p>
            </div>
            <h1 className="hidden font-display text-lg font-bold text-slate-900 lg:block">Commandes</h1>
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="N°, client, téléphone…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none"
              />
            </div>
            <button onClick={load} title="Actualiser" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onLogout} title="Se déconnecter" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 lg:hidden">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${k.box}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight text-slate-900">{k.value}</p>
                    <p className="truncate text-[11px] font-medium text-slate-500">
                      {k.label} · <span className="text-slate-400">{k.sub}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Onglets (mobile / tablette — la sidebar les porte en desktop) */}
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                  tab === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-[11px] font-bold ${tab === t.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Liste */}
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Package className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">{query ? 'Aucun résultat pour cette recherche.' : EMPTY_COPY[tab]}</p>
            </div>
          ) : (
            <>
              {/* Table (desktop) */}
              <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Commande</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                        <th className="px-4 py-3">Paiement</th>
                        <th className="px-4 py-3">Transport</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((o) => {
                        const step = nextStep(o);
                        const stage = stageOf(o.payment_status, o.order_status);
                        return (
                          <tr
                            key={o.id}
                            onClick={() => setOpenId(o.id)}
                            className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {o.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={o.thumbnail} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                                ) : (
                                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                                    <Package className="h-5 w-5" />
                                  </span>
                                )}
                                <div>
                                  <p className="font-mono text-xs font-bold text-slate-900">{o.order_number}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {o.items_count} art. · {fmtDate(o.created_at)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{o.client_name || <span className="italic text-slate-400">Sans nom</span>}</p>
                              <p className="text-[11px] text-slate-400">{o.client_phone || '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtFcfa(total(o))}</td>
                            <td className="px-4 py-3">
                              <IconTag meta={(o.payment_method && PAY_META[o.payment_method]) || PAY_FALLBACK} />
                            </td>
                            <td className="px-4 py-3">
                              <IconTag meta={(o.transport_mode && TRANSPORT_META[o.transport_mode]) || TRANSPORT_FALLBACK} />
                            </td>
                            <td className="px-4 py-3">
                              <StageChip stage={stage} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {step ? (
                                <button
                                  onClick={(e) => quickAct(o, e)}
                                  disabled={busyId === o.id}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ${step.cls}`}
                                >
                                  {busyId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                  {step.label}
                                </button>
                              ) : (
                                <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cartes (mobile) */}
              <ul className="mt-4 space-y-3 md:hidden">
                {visible.map((o) => {
                  const step = nextStep(o);
                  const stage = stageOf(o.payment_status, o.order_status);
                  return (
                    <li key={o.id}>
                      <div onClick={() => setOpenId(o.id)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                          {o.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.thumbnail} alt="" className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
                          ) : (
                            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                              <Package className="h-6 w-6" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-mono text-xs font-bold text-slate-900">{o.order_number}</p>
                              <StageChip stage={stage} />
                            </div>
                            <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
                              {o.client_name || <span className="italic text-slate-400">Sans nom</span>}
                            </p>
                            <p className="text-base font-bold text-slate-900">{fmtFcfa(total(o))}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-2">
                            <IconTag meta={(o.payment_method && PAY_META[o.payment_method]) || PAY_FALLBACK} showLabel={false} />
                            <IconTag meta={(o.transport_mode && TRANSPORT_META[o.transport_mode]) || TRANSPORT_FALLBACK} showLabel={false} />
                          </div>
                          <PipelineStrip done={stageIdx[stage]} />
                        </div>
                        {step && (
                          <button
                            onClick={(e) => quickAct(o, e)}
                            disabled={busyId === o.id}
                            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${step.cls}`}
                          >
                            {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {step.label}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
