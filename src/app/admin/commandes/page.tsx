'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, Loader2, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react';

interface Order {
  id: string;
  offer_id: string;
  client_name: string;
  client_phone: string;
  items_total_fcfa: number | null;
  grand_total_fcfa: number | null;
  transport_mode: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_proof_url: string | null;
  created_at: string;
}

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
      load();
    } finally {
      setBusy(null);
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
              <div key={o.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                {o.payment_proof_url ? (
                  <a href={o.payment_proof_url} target="_blank" rel="noopener noreferrer" className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200">
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
                {o.payment_status === 'submitted' && (
                  <button
                    onClick={() => validate(o)}
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
    </div>
  );
}
