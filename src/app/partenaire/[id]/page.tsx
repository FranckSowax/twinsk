'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Store,
  Loader2,
  Copy,
  Check,
  MessageCircle,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Save,
  Send,
  TrendingUp,
  ShoppingBag,
  Wallet,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface PartnerProduct {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
}
interface PartnerItem {
  id: string;
  description: string | null;
  products: PartnerProduct[];
}
interface RecentOrder {
  id: string;
  client_name: string | null;
  grand_total_fcfa: number | null;
  items_total_fcfa: number | null;
  commission_fcfa: number | null;
  payment_status: string;
  created_at: string;
}
interface PartnerData {
  id: string;
  offer: { id: string; title: string; status: string } | null;
  shop_name: string;
  airtel_number: string | null;
  whatsapp_number: string | null;
  commission_percent: number;
  hidden_product_ids: string[];
  item_order: string[] | null;
  items: PartnerItem[];
  kpis: { orders: number; revenue_fcfa: number; commission_fcfa: number; paid: number };
  recent_orders: RecentOrder[];
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400';

function fmtF(n: number | null | undefined) {
  return n != null ? `${Math.round(Number(n)).toLocaleString('fr-FR')} FCFA` : '—';
}

export default function PartnerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/partner/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Lien invalide');
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center text-slate-500">
        {error || 'Lien invalide ou désactivé'}
      </div>
    );
  }

  const onboarded = !!data.shop_name;

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="mx-auto max-w-2xl space-y-5 px-4">
        {/* En-tête */}
        <div className="flex items-center gap-3 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 text-white">
            <Store className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-bold text-slate-900">
              {data.shop_name || 'Votre boutique'}
            </h1>
            <p className="truncate text-sm text-slate-500">
              Espace partenaire{data.offer ? ` · ${data.offer.title}` : ''}
            </p>
          </div>
        </div>

        {/* Onboarding / profil boutique */}
        <ShopProfile data={data} onSaved={load} />

        {onboarded && (
          <>
            <ShareBlock id={data.id} shopName={data.shop_name} />
            <Kpis data={data} />
            <SettingsBlock data={data} onSaved={load} />
            <ProductsBlock data={data} onSaved={load} />
            <RecentOrders orders={data.recent_orders} />
            <RequestBlock id={data.id} />
          </>
        )}

        <p className="pb-6 text-center text-[11px] text-slate-400">
          Boutique propulsée par TWINSK — espace partenaire.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ShopProfile({ data, onSaved }: { data: PartnerData; onSaved: () => void }) {
  const [shop, setShop] = useState(data.shop_name || '');
  const [airtel, setAirtel] = useState(data.airtel_number || '');
  const [whatsapp, setWhatsapp] = useState(data.whatsapp_number || '');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(!data.shop_name);

  const dirty =
    shop !== (data.shop_name || '') ||
    airtel !== (data.airtel_number || '') ||
    whatsapp !== (data.whatsapp_number || '');

  const save = async () => {
    if (!shop.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/partner/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_name: shop, airtel_number: airtel, whatsapp_number: whatsapp }),
      });
      setOpen(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!open && data.shop_name) {
    return (
      <div className="flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm">
        <div className="min-w-0 text-sm text-slate-600">
          <p>📱 Airtel Money : <b>{data.airtel_number || '—'}</b></p>
          <p>💬 WhatsApp (notifications) : <b>{data.whatsapp_number || '—'}</b></p>
        </div>
        <button onClick={() => setOpen(true)} className="flex-shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-900">
        {data.shop_name ? 'Ma boutique' : '👋 Bienvenue ! Créez votre boutique'}
      </p>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Nom de la boutique *</span>
        <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Ex : La Boutique de Sarah" className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Numéro Airtel Money (encaissement)</span>
        <input value={airtel} onChange={(e) => setAirtel(e.target.value)} placeholder="+241 …" className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Numéro WhatsApp (notifications de vente)</span>
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+241 …" className={inputCls} />
      </label>
      <button
        onClick={save}
        disabled={saving || !shop.trim() || (!dirty && !!data.shop_name)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer ma boutique
      </button>
    </div>
  );
}

function ShareBlock({ id, shopName }: { id: string; shopName: string }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');
  useEffect(() => {
    setLink(`${window.location.origin}/b/${id}`);
  }, [id]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(`Découvrez la boutique ${shopName} : ${link}`)}`;

  return (
    <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-900">🔗 Mon lien de boutique</p>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{link || '…'}</span>
        <button onClick={copy} className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <div className="flex gap-2">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white hover:brightness-95">
          <MessageCircle className="h-4 w-4" /> Partager sur WhatsApp
        </a>
        <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <ExternalLink className="h-4 w-4" /> Voir
        </a>
      </div>
    </div>
  );
}

function Kpis({ data }: { data: PartnerData }) {
  const k = data.kpis;
  const cards = [
    { icon: ShoppingBag, label: 'Commandes', value: String(k.orders), cls: 'text-emerald-600 bg-emerald-50' },
    { icon: TrendingUp, label: 'Ventes', value: fmtF(k.revenue_fcfa), cls: 'text-blue-600 bg-blue-50' },
    { icon: Wallet, label: 'Commissions', value: fmtF(k.commission_fcfa), cls: 'text-amber-600 bg-amber-50' },
    { icon: CheckCircle2, label: 'Payées', value: String(k.paid), cls: 'text-purple-600 bg-purple-50' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${c.cls}`}>
            <c.icon className="h-4 w-4" />
          </div>
          <p className="font-display text-lg font-bold text-slate-900">{c.value}</p>
          <p className="text-xs text-slate-500">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

function SettingsBlock({ data, onSaved }: { data: PartnerData; onSaved: () => void }) {
  const [commission, setCommission] = useState(String(data.commission_percent ?? 0));
  const [saving, setSaving] = useState(false);
  const dirty = Number(commission) !== Number(data.commission_percent ?? 0);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/partner/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commission_percent: Number(commission) || 0 }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-900">💰 Ma commission</p>
      <p className="text-xs text-slate-500">
        Pourcentage ajouté aux prix affichés sur votre boutique. Vous le gagnez sur chaque vente.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-bold text-slate-800 focus:border-emerald-400 focus:outline-none"
        />
        <span className="text-lg font-bold text-slate-500">%</span>
        {dirty && (
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Appliquer
          </button>
        )}
      </div>
    </div>
  );
}

function ProductsBlock({ data, onSaved }: { data: PartnerData; onSaved: () => void }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set(data.hidden_product_ids));
  const [order, setOrder] = useState<string[]>(
    data.item_order?.length ? data.item_order : data.items.map((i) => i.id),
  );
  const [saving, setSaving] = useState(false);

  // Catégories triées selon l'ordre courant (nouvelles catégories à la fin).
  const rank = new Map(order.map((id, i) => [id, i]));
  const sorted = [...data.items].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));

  const dirty =
    JSON.stringify([...hidden].sort()) !== JSON.stringify([...data.hidden_product_ids].sort()) ||
    JSON.stringify(sorted.map((i) => i.id)) !== JSON.stringify(data.items.map((i) => i.id)) ||
    JSON.stringify(order) !== JSON.stringify(data.item_order?.length ? data.item_order : data.items.map((i) => i.id));

  const toggle = (pid: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });

  const move = (itemId: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const ids = sorted.map((i) => i.id);
      const idx = ids.indexOf(itemId);
      const to = idx + dir;
      if (idx === -1 || to < 0 || to >= ids.length) return prev;
      const next = [...ids];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/partner/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden_product_ids: [...hidden], item_order: sorted.map((i) => i.id) }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-bold text-slate-900">🛍️ Mes produits</p>
        {dirty && (
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">Masquez des produits (œil) et réordonnez les catégories (flèches).</p>

      <div className="space-y-4">
        {sorted.map((item, idx) => (
          <div key={item.id}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
                {item.description || 'Catégorie'}
              </p>
              <div className="flex flex-shrink-0 gap-1">
                <button onClick={() => move(item.id, -1)} disabled={idx === 0} className="rounded-md border border-slate-200 p-1 text-slate-500 disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(item.id, 1)} disabled={idx === sorted.length - 1} className="rounded-md border border-slate-200 p-1 text-slate-500 disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {item.products.map((p) => {
                const off = hidden.has(p.id);
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-2 ${off ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}>
                    <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {p.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <span className={`min-w-0 flex-1 truncate text-sm ${off ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{p.title}</span>
                    <button onClick={() => toggle(p.id)} title={off ? 'Afficher' : 'Masquer'} className={`flex-shrink-0 rounded-lg p-1.5 ${off ? 'text-slate-400 hover:text-slate-600' : 'text-emerald-600 hover:text-emerald-700'}`}>
                      {off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  if (!orders.length) return null;
  return (
    <div className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-900">🧾 Dernières commandes</p>
      {orders.map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-700">{o.client_name || 'Panier'}</span>
          <span className="flex-shrink-0 font-semibold text-slate-800">{fmtF(o.grand_total_fcfa ?? o.items_total_fcfa)}</span>
          {Number(o.commission_fcfa) > 0 && (
            <span className="flex-shrink-0 text-xs font-semibold text-amber-600">+{fmtF(o.commission_fcfa)}</span>
          )}
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : o.payment_status === 'submitted' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
            {o.payment_status === 'paid' ? 'Payée' : o.payment_status === 'submitted' ? 'À vérifier' : 'En cours'}
          </span>
        </div>
      ))}
    </div>
  );
}

function RequestBlock({ id }: { id: string }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/partner/${id}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        setSent(true);
        setMessage('');
        setTimeout(() => setSent(false), 3000);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-900">📦 Demander des produits</p>
      <p className="text-xs text-slate-500">
        Décrivez les produits que vous aimeriez vendre — l’équipe TWINSK les sourcera pour vos prochaines offres.
      </p>
      <textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ex : des ventilateurs rechargeables, des mixeurs, des montres connectées…"
        className={inputCls}
      />
      <button
        onClick={send}
        disabled={sending || !message.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {sent ? 'Demande envoyée !' : 'Envoyer ma demande'}
      </button>
    </div>
  );
}
