'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Banknote, CheckCircle2, Plane, PackageCheck, HandHeart, Tag } from 'lucide-react';

type Line = { id: string; product_title?: string | null; variant_name?: string | null; quantity: number; subtotal_fcfa?: number };
type Order = {
  id: string; order_number: string; client_name: string | null; client_phone: string | null;
  grand_total_fcfa: number | null; items_total_fcfa: number | null;
  payment_method: string | null; payment_status: string; order_status: string | null; transport_mode: string | null;
};
type Action = { action: string; created_at: string };
const fmt = (n: number | null | undefined) => (n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—');
const ACTION_LABEL: Record<string, string> = {
  collect_cash: 'Cash encaisse', validate_payment: 'Paiement valide',
  ship: 'Expedie', receive: 'Recu a l\'agence', deliver: 'Remis au client',
};

export default function AgentOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agent/orders/${id}`);
      const j = await r.json();
      setOrder(j.order); setLines(j.lines || []); setActions(j.actions || []);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (path: string) => {
    setBusy(path); setError('');
    try {
      const r = await fetch(`/api/agent/orders/${id}/${path}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Erreur'); return; }
      await load();
    } finally { setBusy(''); }
  };

  if (loading || !order) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;
  }

  const paid = order.payment_status === 'paid';
  const st = order.order_status || 'unpaid';
  const total = order.grand_total_fcfa ?? order.items_total_fcfa;

  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{order.order_number}</span>
      </header>

      <section className="space-y-1 border-b border-slate-100 bg-white px-4 py-4">
        <p className="font-semibold text-slate-900">{order.client_name || 'Client'}</p>
        {order.client_phone && <p className="text-sm text-slate-500">{order.client_phone}</p>}
        <p className="text-lg font-bold text-emerald-700">{fmt(total)}</p>
        <p className="text-xs text-slate-400">
          {paid ? 'Paye' : 'Non paye'} · {st}{order.payment_method ? ` · ${order.payment_method}` : ''}
          {order.transport_mode ? ` · ${order.transport_mode}` : ''}
        </p>
      </section>

      <section className="border-b border-slate-100 bg-white px-4 py-3">
        {lines.map((l) => (
          <div key={l.id} className="flex justify-between py-1 text-sm">
            <span className="text-slate-700">{l.product_title || 'Produit'}{l.variant_name ? ` — ${l.variant_name}` : ''} x{l.quantity}</span>
            <span className="text-slate-500">{fmt(l.subtotal_fcfa)}</span>
          </div>
        ))}
      </section>

      {/* Actions contextuelles */}
      <section className="space-y-2 px-4 py-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {!paid && (
          <>
            <ActionBtn icon={<Banknote className="h-5 w-5" />} label="Encaisser le cash" color="amber"
              busy={busy === 'collect-cash'} onClick={() => act('collect-cash')} />
            <ActionBtn icon={<CheckCircle2 className="h-5 w-5" />} label="Valider le paiement (Airtel/eBilling)" color="emerald"
              busy={busy === 'validate-payment'} onClick={() => act('validate-payment')} />
          </>
        )}
        {paid && st === 'paid' && (
          <ActionBtn icon={<Plane className="h-5 w-5" />} label="Marquer expedie" color="blue"
            busy={busy === 'ship'} onClick={() => act('ship')} />
        )}
        {st === 'shipped' && (
          <ActionBtn icon={<PackageCheck className="h-5 w-5" />} label="Receptionner le colis" color="indigo"
            busy={busy === 'receive'} onClick={() => act('receive')} />
        )}
        {st === 'at_agency' && (
          <ActionBtn icon={<HandHeart className="h-5 w-5" />} label="Remettre au client" color="purple"
            busy={busy === 'deliver'} onClick={() => act('deliver')} />
        )}
        {paid && (
          <a href={`/admin/commandes/${order.id}/etiquette`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 font-semibold text-white">
            <Tag className="h-5 w-5" /> Etiquette d\'envoi
          </a>
        )}
      </section>

      {actions.length > 0 && (
        <section className="px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Historique</p>
          <ul className="space-y-1">
            {actions.map((a, i) => (
              <li key={i} className="flex justify-between text-sm text-slate-600">
                <span>{ACTION_LABEL[a.action] || a.action}</span>
                <span className="text-slate-400">{new Date(a.created_at).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, color, busy, onClick }: {
  icon: React.ReactNode; label: string; color: string; busy: boolean; onClick: () => void;
}) {
  const cls: Record<string, string> = {
    amber: 'bg-amber-500', emerald: 'bg-emerald-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500', purple: 'bg-purple-500',
  };
  return (
    <button onClick={onClick} disabled={busy}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white disabled:opacity-60 ${cls[color]}`}>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon} {label}
    </button>
  );
}
