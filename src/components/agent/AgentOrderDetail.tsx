'use client';

// Détail commande (espace agents) : frise pipeline, encadrés paiement/transport,
// lignes avec images produit, actions contextuelles, historique en timeline.
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  HandCoins,
  HandHeart,
  Loader2,
  MessageCircle,
  Package,
  PackageCheck,
  Plane,
  type LucideIcon,
} from 'lucide-react';
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

type Line = {
  id: string;
  product_title?: string | null;
  product_image?: string | null;
  variant_name?: string | null;
  quantity: number;
  subtotal_fcfa?: number;
};
type Order = {
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
  created_at?: string | null;
};
type Action = { action: string; created_at: string };

const ACTION_META: Record<string, { label: string; icon: LucideIcon; dot: string }> = {
  collect_cash: { label: 'Cash encaissé', icon: HandCoins, dot: 'bg-amber-500' },
  validate_payment: { label: 'Paiement validé', icon: CheckCircle2, dot: 'bg-emerald-500' },
  ship: { label: 'Expédiée', icon: Plane, dot: 'bg-sky-500' },
  receive: { label: 'Reçue à l’agence', icon: Building2, dot: 'bg-teal-500' },
  deliver: { label: 'Remise au client', icon: HandHeart, dot: 'bg-violet-500' },
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
      setOrder(j.order);
      setLines(j.lines || []);
      setActions(j.actions || []);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string) => {
    setBusy(path);
    setError('');
    try {
      const r = await fetch(`/api/agent/orders/${id}/${path}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Erreur');
        return;
      }
      await load();
    } finally {
      setBusy('');
    }
  };

  if (loading || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const paid = order.payment_status === 'paid';
  const st = order.order_status || 'unpaid';
  const stage = stageOf(order.payment_status, order.order_status);
  const total = order.grand_total_fcfa ?? order.items_total_fcfa;
  const waDigits = (order.client_phone || '').replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <button onClick={onBack} aria-label="Retour" className="rounded-lg p-2 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{order.order_number}</span>
          <span className="ml-auto">
            <StageChip stage={stage} />
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {/* Pipeline */}
        <section className="flex justify-center rounded-2xl border border-slate-200 bg-white px-4 py-5">
          <PipelineStrip done={stageIdx[stage]} labels />
        </section>

        {/* Infos clés */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{order.client_name || 'Client sans nom'}</p>
              <p className="text-sm text-slate-500">{order.client_phone || 'Téléphone non renseigné'}</p>
              {order.created_at && <p className="mt-0.5 text-[11px] text-slate-400">Commande du {fmtDate(order.created_at)}</p>}
            </div>
            {waDigits.length >= 6 && (
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Montant</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">{fmtFcfa(total)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Paiement</p>
              <div className="mt-1.5">
                <IconTag meta={(order.payment_method && PAY_META[order.payment_method]) || PAY_FALLBACK} />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Transport</p>
              <div className="mt-1.5">
                <IconTag meta={(order.transport_mode && TRANSPORT_META[order.transport_mode]) || TRANSPORT_FALLBACK} />
              </div>
            </div>
          </div>
        </section>

        {/* Articles */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Articles ({lines.reduce((s, l) => s + (l.quantity || 0), 0)})
          </p>
          <ul className="divide-y divide-slate-100">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                {l.product_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.product_image} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                ) : (
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                    <Package className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{l.product_title || 'Produit'}</p>
                  {l.variant_name && <p className="truncate text-xs text-emerald-600">{l.variant_name}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">{fmtFcfa(l.subtotal_fcfa)}</p>
                  <p className="text-[11px] text-slate-400">×{l.quantity}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Actions contextuelles */}
        <section className="space-y-2">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {!paid && (
            <>
              <ActionBtn
                icon={<Banknote className="h-5 w-5" />}
                label={`Encaisser ${fmtFcfa(total)} en espèces`}
                cls="bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                busy={busy === 'collect-cash'}
                onClick={() => act('collect-cash')}
              />
              <ActionBtn
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Valider le paiement (Airtel / eBilling)"
                cls="bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25"
                busy={busy === 'validate-payment'}
                onClick={() => act('validate-payment')}
              />
            </>
          )}
          {paid && st === 'paid' && (
            <ActionBtn
              icon={<Plane className="h-5 w-5" />}
              label="Marquer expédiée"
              cls="bg-sky-500 hover:bg-sky-600 shadow-sky-500/25"
              busy={busy === 'ship'}
              onClick={() => act('ship')}
            />
          )}
          {st === 'shipped' && (
            <ActionBtn
              icon={<PackageCheck className="h-5 w-5" />}
              label="Réceptionner le colis à l’agence"
              cls="bg-teal-500 hover:bg-teal-600 shadow-teal-500/25"
              busy={busy === 'receive'}
              onClick={() => act('receive')}
            />
          )}
          {st === 'at_agency' && (
            <ActionBtn
              icon={<HandHeart className="h-5 w-5" />}
              label="Remettre au client"
              cls="bg-violet-500 hover:bg-violet-600 shadow-violet-500/25"
              busy={busy === 'deliver'}
              onClick={() => act('deliver')}
            />
          )}
        </section>

        {/* Historique */}
        {actions.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Historique</p>
            <ul className="space-y-3">
              {actions.map((a, i) => {
                const meta = ACTION_META[a.action] || { label: a.action, icon: CheckCircle2, dot: 'bg-slate-400' };
                const Icon = meta.icon;
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white ${meta.dot}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{meta.label}</span>
                    <span className="text-xs text-slate-400">{fmtDate(a.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  cls,
  busy,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  cls: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-semibold text-white shadow-lg transition-colors disabled:opacity-60 ${cls}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon} {label}
    </button>
  );
}
