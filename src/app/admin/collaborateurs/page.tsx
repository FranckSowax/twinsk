'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Loader2,
  Power,
  KeyRound,
  Trash2,
  History,
  RefreshCw,
} from 'lucide-react';
import {
  COLLAB_ROLES,
  COLLAB_ROLE_LABEL,
  type CollabRole,
  type CollabLocale,
} from '@/lib/collab-roles';

interface Collab {
  id: string;
  username: string;
  name: string;
  role: CollabRole;
  default_locale: CollabLocale;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
}

const LOCALE_LABEL: Record<CollabLocale, string> = { fr: 'Français', zh: '中文' };
interface Action {
  id: string;
  collaborator_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  description: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  update_product: 'Mise à jour fiche',
  add_product: 'Ajout produit',
  add_item: 'Ajout catégorie',
  move_product: 'Déplacement produit',
  bulk_import: 'Import JSON',
  update_order: 'Mise à jour commande',
  add_order_line: 'Ajout ligne commande',
  update_order_line: 'Modification ligne commande',
  delete_order_line: 'Suppression ligne commande',
};

const ROLE_BADGE: Record<CollabRole, string> = {
  production: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  commandes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  sourcing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminCollaboratorsPage() {
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'production' as CollabRole,
    default_locale: 'fr' as CollabLocale,
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        fetch('/api/collaborators'),
        fetch('/api/collab-actions'),
      ]);
      const cData = await cRes.json();
      const aData = await aRes.json();
      if (Array.isArray(cData)) setCollabs(cData);
      if (Array.isArray(aData.actions)) setActions(aData.actions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createCollab = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch('/api/collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${data.error || 'Erreur'}`);
        return;
      }
      setMsg('✅ Collaborateur créé');
      setForm({ name: '', username: '', password: '', role: 'production', default_locale: 'fr' });
      load();
    } finally {
      setCreating(false);
    }
  };

  const changeRole = async (c: Collab, role: CollabRole) => {
    await fetch(`/api/collaborators/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    load();
  };

  const changeLocale = async (c: Collab, default_locale: CollabLocale) => {
    await fetch(`/api/collaborators/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_locale }),
    });
    load();
  };

  const toggleActive = async (c: Collab) => {
    await fetch(`/api/collaborators/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  };

  const resetPassword = async (c: Collab) => {
    const pw = window.prompt(`Nouveau mot de passe pour ${c.name} :`);
    if (!pw || pw.length < 4) return;
    await fetch(`/api/collaborators/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    setMsg(`✅ Mot de passe de ${c.name} mis à jour`);
  };

  const removeCollab = async (c: Collab) => {
    if (!window.confirm(`Supprimer le compte de ${c.name} ? (le journal reste conservé)`)) return;
    await fetch(`/api/collaborators/${c.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Collaborateurs</h1>
          <p className="text-sm text-slate-500">Comptes à accès restreint par rôle (Production, Commandes, Sourcing B2B) et journal d’audit.</p>
        </div>
      </div>

      {/* Créer un collaborateur */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <UserPlus className="h-4 w-4" /> Nouveau collaborateur
        </h2>
        <form onSubmit={createCollab} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Li Wei" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Identifiant</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoCapitalize="none" placeholder="liwei" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Mot de passe</label>
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={4} placeholder="min. 4 caractères" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Rôle</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CollabRole })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white">
              {COLLAB_ROLES.map((r) => (
                <option key={r} value={r}>{COLLAB_ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Langue par défaut</label>
            <select value={form.default_locale} onChange={(e) => setForm({ ...form, default_locale: e.target.value as CollabLocale })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white">
              <option value="fr">Français</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <motion.button type="submit" disabled={creating} whileTap={{ scale: 0.98 }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Créer
          </motion.button>
        </form>
        {msg && <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">{msg}</p>}
      </div>

      {/* Liste des collaborateurs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Comptes</h2>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Rafraîchir
          </button>
        </div>
        {collabs.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">Aucun collaborateur. Créez-en un ci-dessus.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-2">Nom</th><th>Identifiant</th><th>Rôle</th><th>Langue</th><th>Statut</th><th>Dernière connexion</th><th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {collabs.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                    <td className="text-slate-500">{c.username}</td>
                    <td>
                      <select
                        value={c.role || 'production'}
                        onChange={(e) => changeRole(c, e.target.value as CollabRole)}
                        title="Changer le rôle"
                        className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[c.role || 'production']}`}
                      >
                        {COLLAB_ROLES.map((r) => (
                          <option key={r} value={r}>{COLLAB_ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={c.default_locale || 'fr'}
                        onChange={(e) => changeLocale(c, e.target.value as CollabLocale)}
                        title="Langue par défaut de l'interface"
                        className="rounded-full border-0 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      >
                        {(['fr', 'zh'] as CollabLocale[]).map((l) => (
                          <option key={l} value={l}>{LOCALE_LABEL[l]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">{c.last_login_at ? fmtDate(c.last_login_at) : '—'}</td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleActive(c)} title={c.active ? 'Désactiver' : 'Activer'} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><Power className="h-4 w-4" /></button>
                        <button onClick={() => resetPassword(c)} title="Changer le mot de passe" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><KeyRound className="h-4 w-4" /></button>
                        <button onClick={() => removeCollab(c)} title="Supprimer" className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Journal d'audit */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <History className="h-4 w-4" /> Journal des actions
        </h2>
        {actions.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">Aucune action enregistrée pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{a.collaborator_name || '—'}</span>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {ACTION_LABEL[a.action] || a.action}
                </span>
                {a.target_type && (
                  <span className="text-xs text-slate-400">
                    {a.target_type === 'offer' ? 'offre' : a.target_type === 'order' ? 'commande' : 'requête'}
                  </span>
                )}
                <span className="text-slate-600 dark:text-slate-300">{a.description}</span>
                <span className="ml-auto text-xs text-slate-400">{fmtDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
