'use client';

// Codes promo : création (lancement « 100 premières commandes », période,
// code personnel, tarif transport négocié), suivi des usages, pause, suppression.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Power, Ticket, Trash2, Users } from 'lucide-react';

type Kind = 'items_percent' | 'items_fixed' | 'air_rate' | 'sea_rate';
const KIND_LABEL: Record<Kind, string> = {
  items_percent: 'Remise % — articles',
  items_fixed: 'Remise FCFA — articles',
  air_rate: 'Tarif aérien — FCFA / kg',
  sea_rate: 'Tarif maritime — FCFA / m³',
};
const VALUE_HINT: Record<Kind, string> = {
  items_percent: 'ex. 10 pour −10 %',
  items_fixed: 'ex. 5000 FCFA',
  air_rate: 'ex. 9000 FCFA / kg (normal : 13 000)',
  sea_rate: 'ex. 200000 FCFA / m³ (normal : 260 000)',
};

interface Promo {
  id: string;
  code: string;
  label: string | null;
  kind: Kind;
  value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  max_uses_per_phone: number;
  client_phone: string | null;
  min_items_fcfa: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  uses: { reserved: number; confirmed: number };
}
interface Use {
  order_id: string;
  client_phone: string | null;
  discount_fcfa: number;
  status: 'reserved' | 'confirmed' | 'released';
  created_at: string;
  order: { client_name: string | null; grand_total_fcfa: number | null; payment_status: string | null; transport_mode: string | null } | null;
}

const EMPTY = {
  code: '',
  label: '',
  kind: 'items_percent' as Kind,
  value: '',
  starts_at: '',
  ends_at: '',
  max_uses: '',
  max_uses_per_phone: '1',
  client_phone: '',
  min_items_fcfa: '',
  notes: '',
};

const fmt = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} FCFA`);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString('fr-FR', { timeZone: 'Africa/Libreville', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const describe = (p: Promo) => {
  const v = Math.round(p.value).toLocaleString('fr-FR');
  if (p.kind === 'items_percent') return `−${p.value} % articles`;
  if (p.kind === 'items_fixed') return `−${v} FCFA articles`;
  if (p.kind === 'air_rate') return `Aérien ${v} FCFA/kg`;
  return `Maritime ${v} FCFA/m³`;
};
const status = (p: Promo) => {
  const now = Date.now();
  if (!p.active) return { label: 'En pause', cls: 'bg-slate-100 text-slate-600' };
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return { label: 'À venir', cls: 'bg-sky-50 text-sky-700' };
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return { label: 'Expiré', cls: 'bg-slate-100 text-slate-500' };
  if (p.max_uses != null && p.uses.reserved + p.uses.confirmed >= p.max_uses) return { label: 'Épuisé', cls: 'bg-amber-50 text-amber-700' };
  return { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700' };
};

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState<Promo | null>(null);
  const [uses, setUses] = useState<Use[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/promos');
      const d = await res.json();
      if (res.ok) setPromos(d.promos || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          label: form.label,
          kind: form.kind,
          value: Number(form.value),
          starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          max_uses_per_phone: Number(form.max_uses_per_phone) || 1,
          client_phone: form.client_phone || null,
          min_items_fcfa: form.min_items_fcfa ? Number(form.min_items_fcfa) : null,
          notes: form.notes,
        }),
      });
      const d = await res.json();
      if (!res.ok) setMsg(`⚠️ ${d.error || 'Échec'}`);
      else {
        setMsg(`✅ Code ${d.promo.code} créé`);
        setForm({ ...EMPTY });
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (p: Promo) => {
    await fetch(`/api/admin/promos/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !p.active }) });
    await load();
  };
  const remove = async (p: Promo) => {
    if (!confirm(`Supprimer le code ${p.code} ? (désactivé s'il a déjà été utilisé)`)) return;
    await fetch(`/api/admin/promos/${p.id}`, { method: 'DELETE' });
    await load();
  };
  const showUses = async (p: Promo) => {
    setOpen(p);
    setUses(null);
    const res = await fetch(`/api/admin/promos/${p.id}`);
    const d = await res.json();
    setUses(d.uses || []);
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';
  const isTransport = form.kind === 'air_rate' || form.kind === 'sea_rate';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Ticket className="h-6 w-6 text-emerald-600" />
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Codes promo</h1>
      </div>

      {/* Création */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <p className="mb-4 text-sm text-slate-500">
          La remise porte sur le <strong>total des articles, hors transport</strong>. Un code transport impose un tarif au kilo (aérien) ou au m³ (maritime), jamais plus cher que le tarif normal. Une seule promo par commande.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={label}>Code</label>
            <input className={field} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LANCEMENT10" />
          </div>
          <div>
            <label className={label}>Type</label>
            <select className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Valeur</label>
            <input className={field} type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={VALUE_HINT[form.kind]} />
          </div>
          <div>
            <label className={label}>Début (optionnel)</label>
            <input className={field} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </div>
          <div>
            <label className={label}>Fin (optionnel)</label>
            <input className={field} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </div>
          <div>
            <label className={label}>Nombre max d’utilisations</label>
            <input className={field} type="number" min={0} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="ex. 100 = 100 premières commandes · vide = illimité" />
          </div>
          <div>
            <label className={label}>Max par client (numéro WhatsApp)</label>
            <input className={field} type="number" min={1} value={form.max_uses_per_phone} onChange={(e) => setForm({ ...form, max_uses_per_phone: e.target.value })} />
          </div>
          <div>
            <label className={label}>Code personnel — numéro du client</label>
            <input className={field} value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="+241 07 … (vide = tout le monde)" />
          </div>
          <div>
            <label className={label}>Minimum d’articles (FCFA)</label>
            <input className={field} type="number" min={0} value={form.min_items_fcfa} onChange={(e) => setForm({ ...form, min_items_fcfa: e.target.value })} placeholder="vide = aucun" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Libellé interne</label>
            <input className={field} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Lancement — 100 premières commandes" />
          </div>
          <div>
            <label className={label}>Notes</label>
            <input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        {isTransport && (
          <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Ce code ne change que le transport {form.kind === 'air_rate' ? 'aérien' : 'maritime'} de la commande ; le client paie ses articles au prix normal.
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={create} disabled={creating || !form.code || !form.value} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer le code
          </button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </div>

      {/* Liste */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
        ) : promos.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Aucun code pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {promos.map((p) => {
              const st = status(p);
              const used = p.uses.reserved + p.uses.confirmed;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-[10rem] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900 dark:text-white">{p.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      {p.client_phone && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">perso · {p.client_phone}</span>}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{describe(p)}{p.label ? ` · ${p.label}` : ''}</p>
                    <p className="text-xs text-slate-400">
                      {fmtDate(p.starts_at)} → {fmtDate(p.ends_at)} · max {p.max_uses ?? '∞'} · {p.max_uses_per_phone}/client{p.min_items_fcfa ? ` · dès ${fmt(p.min_items_fcfa)}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => showUses(p)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">
                    <Users className="h-3.5 w-3.5" /> {used}{p.max_uses ? `/${p.max_uses}` : ''} · {p.uses.confirmed} payé{p.uses.confirmed > 1 ? 's' : ''}
                  </button>
                  <button type="button" onClick={() => toggle(p)} title={p.active ? 'Mettre en pause' : 'Réactiver'} className={`rounded-lg p-2 ${p.active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                    <Power className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(p)} title="Supprimer" className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Usages */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Usages de {open.code}</h2>
            {uses === null ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : uses.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">Jamais utilisé.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr><th className="py-1">Quand</th><th>Client</th><th>Commande</th><th>Remise</th><th>Statut</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {uses.map((u) => (
                    <tr key={u.order_id}>
                      <td className="py-1.5 text-xs text-slate-500">{fmtDate(u.created_at)}</td>
                      <td>{u.order?.client_name || '—'}<br /><span className="text-xs text-slate-400">{u.client_phone || '—'}</span></td>
                      <td className="text-xs">{fmt(u.order?.grand_total_fcfa)}<br /><span className="text-slate-400">{u.order?.payment_status || '—'}</span></td>
                      <td>{u.discount_fcfa ? fmt(u.discount_fcfa) : 'transport'}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : u.status === 'reserved' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.status === 'confirmed' ? 'payé' : u.status === 'reserved' ? 'réservé' : 'libéré'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
