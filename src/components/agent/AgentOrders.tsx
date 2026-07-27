'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, RefreshCw } from 'lucide-react';
import AgentOrderDetail from './AgentOrderDetail';

type Agent = { id: string; name: string };
type Row = {
  id: string; order_number: string; client_name: string | null; client_phone: string | null;
  grand_total_fcfa: number | null; items_total_fcfa: number | null;
  payment_method: string | null; payment_status: string; order_status: string | null;
  transport_mode: string | null; created_at: string;
};

const TABS: { key: string; label: string }[] = [
  { key: 'to_collect', label: 'À encaisser' },
  { key: 'to_ship', label: 'À expédier' },
  { key: 'to_receive', label: 'À réceptionner' },
  { key: 'to_deliver', label: 'À remettre' },
  { key: 'all', label: 'Toutes' },
];
const fmt = (n: number | null) => (n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—');

export default function AgentOrders({ agent, onLogout }: { agent: Agent; onLogout: () => void }) {
  const [tab, setTab] = useState('to_collect');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agent/orders?filter=${tab}`);
      const j = await r.json();
      setRows(j.orders || []);
    } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  if (openId) {
    return <AgentOrderDetail id={openId} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div><p className="text-xs text-slate-400">Agent</p><p className="font-semibold text-slate-900">{agent.name}</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={onLogout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-slate-400">Aucune commande.</p>
      ) : (
        <ul className="space-y-2 px-4">
          {rows.map((o) => (
            <li key={o.id}>
              <button onClick={() => setOpenId(o.id)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">{o.order_number}</span>
                  <span className="font-semibold text-emerald-700">{fmt(o.grand_total_fcfa ?? o.items_total_fcfa)}</span>
                </div>
                <p className="mt-1 font-semibold text-slate-900">{o.client_name || 'Client'}</p>
                <p className="text-xs text-slate-400">
                  {o.payment_status === 'paid' ? 'Payé' : 'À encaisser'} · {o.order_status || 'unpaid'}
                  {o.payment_method ? ` · ${o.payment_method}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
