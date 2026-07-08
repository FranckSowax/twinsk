'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, Loader2, RefreshCw, CheckCircle2, ExternalLink, X, Package, CreditCard, QrCode } from 'lucide-react';

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
}

interface DetailLine {
  id: string;
  product_id: string | null;
  product_title: string | null;
  product_image: string | null;
  product_url: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price_fcfa: number;
  subtotal_fcfa: number;
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
  { value: 'delivered', label: 'Livrée' },
];
const ORDER_STATUS_CLS: Record<string, string> = {
  unpaid: 'border-slate-300 text-slate-600',
  paid: 'border-emerald-300 text-emerald-700 bg-emerald-50',
  shipped: 'border-blue-300 text-blue-700 bg-blue-50',
  delivered: 'border-purple-300 text-purple-700 bg-purple-50',
};
// L'étiquette d'envoi est disponible dès que la commande est payée.
const canLabel = (s: string) => s === 'paid' || s === 'shipped' || s === 'delivered';

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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyPending, setOnlyPending] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders${onlyPending ? '?pending=1' : ''}`);
      const data = await res.json();
      if (Array.isArray(data.orders)) setOrders(data.orders);
    } finally {
      setLoading(false);
    }
  }, [onlyPending]);

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Commandes</h1>
          <p className="text-sm text-slate-500">Vérifiez les paiements Airtel Money et validez les commandes.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="h-4 w-4 rounded" />
          À vérifier seulement
        </label>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : orders.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">Aucune commande{onlyPending ? ' à vérifier' : ''}.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const pay = PAY_LABEL[o.payment_status] || PAY_LABEL.pending;
            return (
              <div
                key={o.id}
                onClick={() => openDetail(o.id)}
                className="flex cursor-pointer flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-slate-700 dark:bg-slate-800"
              >
                {o.payment_proof_url ? (
                  <a onClick={(e) => e.stopPropagation()} href={o.payment_proof_url} target="_blank" rel="noopener noreferrer" className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.payment_proof_url} alt="Preuve" className="h-full w-full object-cover" />
                    <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 p-0.5 text-white"><ExternalLink className="h-3 w-3" /></span>
                  </a>
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400 dark:bg-slate-700">sans preuve</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{o.client_name} <span className="text-xs font-normal text-slate-400">· {o.client_phone}</span></p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {fmt(o.grand_total_fcfa || o.items_total_fcfa)}
                    {o.transport_mode && <span className="text-xs text-slate-400"> · {o.transport_mode === 'air' ? 'aérien' : o.transport_mode === 'sea' ? 'maritime' : 'devis'}</span>}
                    {o.payment_method && <span className="text-xs text-slate-400"> · {o.payment_method}</span>}
                  </p>
                  <p className="text-[11px] text-slate-400">{fmtDate(o.created_at)}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${pay.cls}`}>{pay.txt}</span>

                {/* Statut de traitement — dropdown */}
                <select
                  value={o.order_status || 'unpaid'}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); changeStatus(o.id, e.target.value); }}
                  disabled={busy === o.id}
                  className={`flex-shrink-0 rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60 ${ORDER_STATUS_CLS[o.order_status || 'unpaid']}`}
                >
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                {/* Étiquette d'envoi (dès que payée) */}
                {canLabel(o.order_status) && (
                  <a
                    href={`/admin/commandes/${o.id}/etiquette`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Étiquette d'envoi"
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                  >
                    <QrCode className="h-3.5 w-3.5" /> Étiquette
                  </a>
                )}

                {o.payment_status === 'submitted' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); validate(o); }}
                    disabled={busy === o.id}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Valider
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                          <Package className="h-5 w-5 text-emerald-500" /> Commande
                        </h2>
                        {d.offer_title && <p className="truncate text-sm text-slate-500">{d.offer_title}</p>}
                        <p className="text-[11px] text-slate-400">#{d.id.slice(0, 8)} · {fmtDate(d.created_at)}</p>
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

                    {/* Client */}
                    <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
                      <p className="font-semibold text-slate-900 dark:text-white">{d.client_name || '—'}</p>
                      <p className="text-slate-600 dark:text-slate-300">📱 {d.client_phone || '—'}</p>
                      {d.client_email && <p className="text-slate-600 dark:text-slate-300">✉️ {d.client_email}</p>}
                    </div>

                    {/* Lignes */}
                    <div className="mb-4 space-y-2">
                      {detail.lines.map((l) => (
                        <div key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                            {l.product_image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={l.product_image} alt={l.product_title || ''} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300"><ShoppingBag className="h-5 w-5" /></div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{l.product_title || (l.product_id ? `Produit #${l.product_id.slice(0, 8)}` : 'Produit')}</p>
                            {l.variant_name && <p className="text-xs text-emerald-600">{l.variant_name}</p>}
                            <p className="text-xs text-slate-500">{l.quantity} × {fmt(l.unit_price_fcfa)}</p>
                          </div>
                          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                            <p className="text-sm font-bold text-emerald-600">{fmt(l.subtotal_fcfa)}</p>
                            {l.product_url ? (
                              <a
                                href={l.product_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Payer le fournisseur sur 1688"
                                className="flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-600"
                              >
                                <CreditCard className="h-3 w-3" /> Payer
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400">Lien 1688 indisponible</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totaux */}
                    <div className="mb-4 space-y-1.5 rounded-2xl bg-slate-900 p-4 text-sm text-white">
                      <div className="flex justify-between text-slate-300"><span>Sous-total produits</span><span>{fmt(d.items_total_fcfa)}</span></div>
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
