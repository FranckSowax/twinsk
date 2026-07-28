'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Loader2, RefreshCw, CheckCircle2, ExternalLink, X, Package, CreditCard, QrCode, Save, Trash2, Plus, Plane, Ship, Search, ChevronRight, HandCoins, Banknote, BadgeAlert, HandHeart } from 'lucide-react';
import { orderNumber } from '@/lib/order-number';
import {
  stageOf,
  stageIdx,
  StageChip,
  IconTag,
  PipelineStrip,
  PAY_META,
  PAY_FALLBACK,
  TRANSPORT_META,
  TRANSPORT_FALLBACK,
} from '@/components/agent/agent-ui';

interface Order {
  id: string;
  offer_id: string;
  client_name: string;
  client_phone: string;
  items_total_fcfa: number | null;
  grand_total_fcfa: number | null;
  transport_mode: string | null;
  status: string;
  order_status: string;
  payment_status: string;
  payment_method: string | null;
  payment_proof_url: string | null;
  created_at: string;
  thumbnail?: string | null;
  items_count?: number;
}

interface DetailLine {
  id: string;
  product_id: string | null;
  product_title: string | null;
  product_image: string | null;
  product_url: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price_cny: number | null;
  unit_price_fcfa: number;
  subtotal_fcfa: number;
  weight: number | null;
  volume: number | null;
  has_battery: boolean | null;
}
interface OrderDetail {
  order: Order & {
    client_email: string | null;
    transport_cost: number | null;
    total_weight: number | null;
    total_volume: number | null;
    ebilling_reference: string | null;
    offer_title: string | null;
  };
  lines: DetailLine[];
}

const TRANSPORT_LABEL: Record<string, string> = { air: 'Aérien', sea: 'Maritime', quote: 'Devis' };

const ORDER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'unpaid', label: 'Non payé' },
  { value: 'paid', label: 'Payée' },
  { value: 'shipped', label: 'Expédié' },
  { value: 'at_agency', label: 'Reçu à l\'agence' },
  { value: 'delivered', label: 'Livrée' },
];
const ORDER_STATUS_CLS: Record<string, string> = {
  unpaid: 'border-slate-300 text-slate-600',
  paid: 'border-emerald-300 text-emerald-700 bg-emerald-50',
  shipped: 'border-blue-300 text-blue-700 bg-blue-50',
  at_agency: 'border-teal-300 text-teal-700 bg-teal-50',
  delivered: 'border-purple-300 text-purple-700 bg-purple-50',
};
// L'étiquette d'envoi est disponible dès que la commande est payée.
const canLabel = (s: string) => s === 'paid' || s === 'shipped' || s === 'at_agency' || s === 'delivered';

const PAY_LABEL: Record<string, { txt: string; cls: string }> = {
  submitted: { txt: 'À vérifier', cls: 'bg-amber-100 text-amber-700' },
  paid: { txt: 'Validé', cls: 'bg-emerald-100 text-emerald-700' },
  pending: { txt: 'En attente', cls: 'bg-slate-100 text-slate-500' },
};

function fmt(n: number | null) {
  return n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—';
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Onglets de filtrage (la sidebar admin existe déjà — ici, des onglets).
const TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'to_verify', label: 'À vérifier' },
  { key: 'to_collect', label: 'À encaisser' },
  { key: 'to_ship', label: 'À expédier' },
  { key: 'shipped', label: 'Expédiées' },
  { key: 'at_agency', label: 'À l’agence' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'carts', label: 'Paniers' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const totalOf = (o: Order) => o.grand_total_fcfa ?? o.items_total_fcfa;

function inTab(tab: TabKey, o: Order): boolean {
  switch (tab) {
    case 'to_verify':
      return o.payment_status === 'submitted';
    case 'to_collect':
      return o.payment_status !== 'paid' && o.status !== 'cart';
    case 'to_ship':
      return o.payment_status === 'paid' && (o.order_status === 'paid' || !o.order_status);
    case 'shipped':
      return o.order_status === 'shipped';
    case 'at_agency':
      return o.order_status === 'at_agency';
    case 'delivered':
      return o.order_status === 'delivered';
    case 'carts':
      return o.status === 'cart';
    default:
      return true;
  }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      if (Array.isArray(data.orders)) setOrders(data.orders);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const validate = async (o: Order) => {
    if (!window.confirm(`Valider le paiement de ${o.client_name} (${fmt(o.grand_total_fcfa || o.items_total_fcfa)}) ?`)) return;
    setBusy(o.id);
    try {
      await fetch(`/api/admin/orders/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'paid' }),
      });
      await load();
      if (detail?.order.id === o.id) {
        setDetail((d) => (d ? { ...d, order: { ...d.order, payment_status: 'paid', status: 'paid', order_status: 'paid' } } : d));
      }
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = async (id: string, order_status: string) => {
    setBusy(id);
    try {
      await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_status }),
      });
      // Optimiste : maj locale immédiate (liste + modal), sans recharger si filtre actif.
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, order_status } : o)));
      setDetail((d) => (d && d.order.id === id ? { ...d, order: { ...d.order, order_status } } : d));
    } finally {
      setBusy(null);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  };

  // Recharge le détail sans flicker (garde le modal ouvert) + rafraîchit la liste.
  const reloadDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data);
    } catch {
      // ignore
    }
    load();
  };

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TABS) c[t.key] = orders.filter((o) => inTab(t.key, o)).length;
    return c;
  }, [orders]);

  const kpis = useMemo(() => {
    const toVerify = orders.filter((o) => inTab('to_verify', o));
    const toCollect = orders.filter((o) => inTab('to_collect', o));
    const collected = orders.filter((o) => o.payment_status === 'paid');
    const sum = (list: Order[]) => list.reduce((s, o) => s + (totalOf(o) || 0), 0);
    return [
      { label: 'À vérifier', value: String(toVerify.length), sub: 'preuves de paiement', icon: BadgeAlert, box: 'bg-red-50 text-red-600 ring-red-200' },
      { label: 'À encaisser', value: String(toCollect.length), sub: fmt(sum(toCollect)), icon: HandCoins, box: 'bg-amber-50 text-amber-600 ring-amber-200' },
      { label: 'Encaissé', value: fmt(sum(collected)), sub: `${collected.length} commande${collected.length > 1 ? 's' : ''}`, icon: Banknote, box: 'bg-emerald-50 text-emerald-600 ring-emerald-200', wide: true },
      { label: 'Livrées', value: String(counts.delivered), sub: 'remises au client', icon: HandHeart, box: 'bg-violet-50 text-violet-600 ring-violet-200' },
    ];
  }, [orders, counts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => inTab(tab, o))
      .filter(
        (o) =>
          !q ||
          orderNumber(o.id).toLowerCase().includes(q) ||
          (o.client_name || '').toLowerCase().includes(q) ||
          (o.client_phone || '').includes(q),
      );
  }, [orders, tab, query]);

  // Cellules réutilisées par la table et les cartes.
  const statusSelect = (o: Order, compact = false) => (
    <select
      value={o.order_status || 'unpaid'}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => { e.stopPropagation(); changeStatus(o.id, e.target.value); }}
      disabled={busy === o.id}
      className={`rounded-lg border bg-white px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60 dark:bg-slate-800 ${compact ? 'w-full' : ''} ${ORDER_STATUS_CLS[o.order_status || 'unpaid']}`}
    >
      {ORDER_STATUS_OPTIONS.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );

  const stageCell = (o: Order) =>
    o.status === 'cart' ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Panier
      </span>
    ) : (
      <StageChip stage={stageOf(o.payment_status, o.order_status)} />
    );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* En-tête + recherche */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Commandes</h1>
          <p className="text-sm text-slate-500">Paiements, logistique et suivi jusqu’à la remise client.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="N°, client, téléphone…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <button onClick={load} disabled={loading} title="Rafraîchir" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${k.box}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className={`font-bold leading-tight text-slate-900 dark:text-white ${k.wide ? 'text-sm sm:text-base' : 'text-xl'}`}>{k.value}</p>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {k.label} · <span className="text-slate-400">{k.sub}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Onglets */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-slate-900 text-white dark:bg-emerald-500'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-emerald-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] font-bold ${tab === t.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Chargement…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center dark:border-slate-600 dark:bg-slate-800">
          <Package className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">{query ? 'Aucun résultat pour cette recherche.' : 'Aucune commande dans cet onglet.'}</p>
        </div>
      ) : (
        <>
          {/* Table (desktop) */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                    <th className="px-4 py-3">Commande</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3">Paiement</th>
                    <th className="px-4 py-3">Transport</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Traitement</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => openDetail(o.id)}
                      className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {o.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.thumbnail} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                          ) : (
                            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200 dark:bg-slate-700">
                              <Package className="h-5 w-5" />
                            </span>
                          )}
                          <div>
                            <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">{orderNumber(o.id)}</p>
                            <p className="text-[11px] text-slate-400">
                              {o.items_count || 0} art. · {fmtDate(o.created_at)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {o.client_name || <span className="italic text-slate-400">Sans coordonnées</span>}
                        </p>
                        <p className="text-[11px] text-slate-400">{o.client_phone || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{fmt(totalOf(o))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <IconTag meta={(o.payment_method && PAY_META[o.payment_method]) || PAY_FALLBACK} />
                          {o.payment_proof_url && (
                            <a
                              onClick={(e) => e.stopPropagation()}
                              href={o.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Voir la preuve de paiement"
                              className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-600 hover:bg-amber-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <IconTag meta={(o.transport_mode && TRANSPORT_META[o.transport_mode]) || TRANSPORT_FALLBACK} />
                      </td>
                      <td className="px-4 py-3">{stageCell(o)}</td>
                      <td className="px-4 py-3">{statusSelect(o)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {o.payment_status === 'submitted' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); validate(o); }}
                              disabled={busy === o.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
                            >
                              {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Valider
                            </button>
                          )}
                          {canLabel(o.order_status) && (
                            <a
                              href={`/admin/commandes/${o.id}/etiquette`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Étiquette d'envoi"
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cartes (mobile) */}
          <ul className="space-y-3 md:hidden">
            {visible.map((o) => (
              <li key={o.id}>
                <div onClick={() => openDetail(o.id)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-start gap-3">
                    {o.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.thumbnail} alt="" className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
                    ) : (
                      <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 ring-1 ring-slate-200 dark:bg-slate-700">
                        <Package className="h-6 w-6" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">{orderNumber(o.id)}</p>
                        {stageCell(o)}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {o.client_name || <span className="italic text-slate-400">Sans coordonnées</span>}
                      </p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">{fmt(totalOf(o))}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <IconTag meta={(o.payment_method && PAY_META[o.payment_method]) || PAY_FALLBACK} showLabel={false} />
                      <IconTag meta={(o.transport_mode && TRANSPORT_META[o.transport_mode]) || TRANSPORT_FALLBACK} showLabel={false} />
                      {o.payment_proof_url && (
                        <a
                          onClick={(e) => e.stopPropagation()}
                          href={o.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Preuve de paiement"
                          className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-600"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    {o.status !== 'cart' && <PipelineStrip done={stageIdx[stageOf(o.payment_status, o.order_status)]} />}
                  </div>
                  <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex-1">{statusSelect(o, true)}</div>
                    {o.payment_status === 'submitted' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); validate(o); }}
                        disabled={busy === o.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Valider
                      </button>
                    )}
                    {canLabel(o.order_status) && (
                      <a
                        href={`/admin/commandes/${o.id}/etiquette`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 dark:border-slate-600 dark:text-slate-300"
                        title="Étiquette d'envoi"
                      >
                        <QrCode className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Modal détail commande */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => { setDetail(null); }}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !detail ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
              </div>
            ) : (
              (() => {
                const d = detail.order;
                const pay = PAY_LABEL[d.payment_status] || PAY_LABEL.pending;
                return (
                  <>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                          <Package className="h-5 w-5 text-emerald-500" /> Commande
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-white dark:bg-slate-700">{orderNumber(d.id)}</span>
                        </h2>
                        {d.offer_title && <p className="truncate text-sm text-slate-500">{d.offer_title}</p>}
                        <p className="text-[11px] text-slate-400">{fmtDate(d.created_at)}</p>
                      </div>
                      <button onClick={() => setDetail(null)} className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pay.cls}`}>{pay.txt}</span>
                      {d.payment_method && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{d.payment_method}</span>}
                      {d.transport_mode && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{TRANSPORT_LABEL[d.transport_mode] || d.transport_mode}</span>}
                    </div>

                    {/* Client (éditable) */}
                    <ClientEditor order={d} onSaved={() => reloadDetail(d.id)} />

                    {/* Mode de transport (éditable) */}
                    <TransportSelector order={d} onSaved={() => reloadDetail(d.id)} />

                    {/* Lignes (éditables) */}
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produits</p>
                      {(d.total_weight == null || d.total_volume == null) && (
                        <span className="text-[11px] font-medium text-amber-600">⚠️ Poids/volume manquants — total transport indisponible</span>
                      )}
                    </div>
                    <div className="mb-3 space-y-2">
                      {detail.lines.map((l) => (
                        <LineEditor key={l.id} orderId={d.id} line={l} onSaved={() => reloadDetail(d.id)} />
                      ))}
                    </div>

                    {/* Ajouter un produit */}
                    <AddLineForm orderId={d.id} onSaved={() => reloadDetail(d.id)} />

                    {/* Totaux */}
                    <div className="mb-4 mt-4 space-y-1.5 rounded-2xl bg-slate-900 p-4 text-sm text-white">
                      <div className="flex justify-between text-slate-300"><span>Sous-total produits</span><span>{fmt(d.items_total_fcfa)}</span></div>
                      <div className="flex justify-between text-slate-400 text-xs">
                        <span>Poids : {d.total_weight != null ? `${d.total_weight} kg` : '—'} · Volume : {d.total_volume != null ? `${d.total_volume} m³` : '—'}</span>
                      </div>
                      {d.transport_mode && d.transport_mode !== 'quote' && (
                        <div className="flex justify-between text-slate-300"><span>Transport ({TRANSPORT_LABEL[d.transport_mode]})</span><span>{fmt(d.transport_cost)}</span></div>
                      )}
                      <div className="mt-1 flex justify-between border-t border-white/10 pt-2 font-bold"><span>Total</span><span className="text-emerald-400">{fmt(d.grand_total_fcfa || d.items_total_fcfa)}</span></div>
                    </div>

                    {/* Preuve de paiement Airtel */}
                    {d.payment_proof_url && (
                      <div className="mb-4">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Preuve de paiement</p>
                        <a href={d.payment_proof_url} target="_blank" rel="noopener noreferrer" className="inline-block overflow-hidden rounded-xl ring-1 ring-slate-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.payment_proof_url} alt="Preuve" className="max-h-64 w-auto object-contain" />
                        </a>
                      </div>
                    )}
                    {d.ebilling_reference && (
                      <p className="mb-4 text-xs text-slate-500">Réf. eBilling : <span className="font-mono">{d.ebilling_reference}</span></p>
                    )}

                    {/* Statut de traitement */}
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</span>
                      <select
                        value={d.order_status || 'unpaid'}
                        onChange={(e) => changeStatus(d.id, e.target.value)}
                        disabled={busy === d.id}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60 ${ORDER_STATUS_CLS[d.order_status || 'unpaid']}`}
                      >
                        {ORDER_STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {d.payment_status === 'submitted' && (
                        <button
                          onClick={() => validate(d)}
                          disabled={busy === d.id}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Valider le paiement
                        </button>
                      )}
                      {canLabel(d.order_status) && (
                        <a
                          href={`/admin/commandes/${d.id}/etiquette`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          <QrCode className="h-4 w-4" /> Étiquette d’envoi
                        </a>
                      )}
                      <a
                        href={`/offer/${d.offer_id}/order/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                      >
                        <ExternalLink className="h-4 w-4" /> Page client
                      </a>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants d'édition (admin)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function ClientEditor({
  order,
  onSaved,
}: {
  order: OrderDetail['order'];
  onSaved: () => void;
}) {
  const [name, setName] = useState(order.client_name || '');
  const [phone, setPhone] = useState(order.client_phone || '');
  const [email, setEmail] = useState(order.client_email || '');
  const [saving, setSaving] = useState(false);
  const dirty =
    name !== (order.client_name || '') ||
    phone !== (order.client_phone || '') ||
    email !== (order.client_email || '');

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: name, client_phone: phone, client_email: email }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 space-y-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Coordonnées client</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Téléphone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={inputCls} placeholder="Email (optionnel)" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer les coordonnées
        </button>
      )}
    </div>
  );
}

function TransportSelector({
  order,
  onSaved,
}: {
  order: OrderDetail['order'];
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const set = async (mode: string) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transport_mode: mode }),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  const opt = (mode: string, label: string, Icon: typeof Plane) => (
    <button
      onClick={() => set(mode)}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
        order.transport_mode === mode
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Mode de transport</p>
      <div className="flex flex-wrap gap-2">
        {opt('air', 'Aérien', Plane)}
        {opt('sea', 'Maritime', Ship)}
        {opt('quote', 'Devis', CreditCard)}
      </div>
    </div>
  );
}

function LineEditor({
  orderId,
  line,
  onSaved,
}: {
  orderId: string;
  line: DetailLine;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState(String(line.quantity));
  const [priceCny, setPriceCny] = useState(line.unit_price_cny != null ? String(line.unit_price_cny) : '');
  const [weight, setWeight] = useState(line.weight != null ? String(line.weight) : '');
  const [volume, setVolume] = useState(line.volume != null ? String(line.volume) : '');
  const [battery, setBattery] = useState(!!line.has_battery);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(false);

  const dirty =
    qty !== String(line.quantity) ||
    priceCny !== (line.unit_price_cny != null ? String(line.unit_price_cny) : '') ||
    weight !== (line.weight != null ? String(line.weight) : '') ||
    volume !== (line.volume != null ? String(line.volume) : '') ||
    battery !== !!line.has_battery;

  const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: Math.max(1, Math.trunc(Number(qty) || 1)),
          unit_price_cny: num(priceCny) ?? 0,
          weight: num(weight),
          volume: num(volume),
          has_battery: battery,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Retirer ce produit de la commande ?')) return;
    setDel(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/lines/${line.id}`, { method: 'DELETE' });
      onSaved();
    } finally {
      setDel(false);
    }
  };

  const missing = weight.trim() === '' || volume.trim() === '';

  return (
    <div className={`rounded-xl border p-2.5 ${missing ? 'border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-900/10' : 'border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
          {line.product_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={line.product_image} alt={line.product_title || ''} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300"><ShoppingBag className="h-4 w-4" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{line.product_title || 'Produit'}</p>
          {line.variant_name && <p className="text-xs text-emerald-600">{line.variant_name}</p>}
        </div>
        {line.product_url && (
          <a href={line.product_url} target="_blank" rel="noopener noreferrer" title="Payer le fournisseur sur 1688" className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-orange-600">
            <CreditCard className="h-3 w-3" /> Payer
          </a>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[10px] font-medium text-slate-500">Qté
          <input className={inputCls} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="text-[10px] font-medium text-slate-500">Prix (CNY)
          <input className={inputCls} type="number" step="any" value={priceCny} onChange={(e) => setPriceCny(e.target.value)} />
        </label>
        <label className={`text-[10px] font-medium ${weight.trim() === '' ? 'text-amber-600' : 'text-slate-500'}`}>Poids (kg)
          <input className={inputCls} type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className={`text-[10px] font-medium ${volume.trim() === '' ? 'text-amber-600' : 'text-slate-500'}`}>Volume (m³)
          <input className={inputCls} type="number" step="any" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={battery} onChange={(e) => setBattery(e.target.checked)} className="h-3.5 w-3.5 rounded" /> Batterie
        </label>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={save} disabled={saving} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Enregistrer
            </button>
          )}
          <button onClick={remove} disabled={del} className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
            {del ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddLineForm({ orderId, onSaved }: { orderId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priceCny, setPriceCny] = useState('');
  const [qty, setQty] = useState('1');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [battery, setBattery] = useState(false);
  const [saving, setSaving] = useState(false);

  const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_title: title.trim(),
          unit_price_cny: num(priceCny) ?? 0,
          quantity: Math.max(1, Math.trunc(Number(qty) || 1)),
          weight: num(weight),
          volume: num(volume),
          has_battery: battery,
        }),
      });
      setTitle(''); setPriceCny(''); setQty('1'); setWeight(''); setVolume(''); setBattery(false);
      setOpen(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300">
        <Plus className="h-3.5 w-3.5" /> Ajouter un produit
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-900/10">
      <input className={inputCls} placeholder="Nom du produit *" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[10px] font-medium text-slate-500">Prix (CNY)
          <input className={inputCls} type="number" step="any" value={priceCny} onChange={(e) => setPriceCny(e.target.value)} />
        </label>
        <label className="text-[10px] font-medium text-slate-500">Qté
          <input className={inputCls} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="text-[10px] font-medium text-slate-500">Poids (kg)
          <input className={inputCls} type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="text-[10px] font-medium text-slate-500">Volume (m³)
          <input className={inputCls} type="number" step="any" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={battery} onChange={(e) => setBattery(e.target.checked)} className="h-3.5 w-3.5 rounded" /> Batterie
        </label>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-600">Annuler</button>
          <button onClick={add} disabled={saving || !title.trim()} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
