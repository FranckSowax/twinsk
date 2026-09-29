'use client';

import { useCallback, useEffect, useState } from 'react';
import BusinessKpis from '@/components/admin/BusinessKpis';
import ActivityDashboard from '@/components/admin/ActivityDashboard';
import {
  Users,
  Loader2,
  UserPlus,
  Trash2,
  Mail,
  CheckCircle2,
  CircleDot,
  Ban,
  Shield,
  Eye,
  UserCog,
} from 'lucide-react';

type Role = 'admin' | 'agent' | 'viewer';
type CollabStatus = 'invited' | 'active' | 'disabled';

interface Collaborator {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: CollabStatus;
  invited_at: string;
  last_seen_at: string | null;
}

const ROLE_META: Record<Role, { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }> = {
  admin: { label: 'Admin', icon: Shield, classes: 'bg-amber-100 text-amber-700' },
  agent: { label: 'Agent', icon: UserCog, classes: 'bg-blue-100 text-blue-700' },
  viewer: { label: 'Lecture', icon: Eye, classes: 'bg-slate-100 text-slate-600' },
};

const STATUS_META: Record<CollabStatus, { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }> = {
  invited: { label: 'Invité', icon: CircleDot, classes: 'bg-blue-50 text-blue-700' },
  active: { label: 'Actif', icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700' },
  disabled: { label: 'Désactivé', icon: Ban, classes: 'bg-slate-100 text-slate-500' },
};

export default function AdminDashboard() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetch('/api/admin/collaborators').then((r) => (r.ok ? r.json() : []));
      if (Array.isArray(c)) setCollaborators(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Email requis');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/admin/collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'invitation');
        return;
      }
      setCollaborators((prev) => [data, ...prev]);
      setEmail('');
      setName('');
    } catch {
      setError('Erreur réseau');
    } finally {
      setInviting(false);
    }
  };

  const updateCollab = async (id: string, patch: Partial<Collaborator>) => {
    const res = await fetch(`/api/admin/collaborators/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setCollaborators((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const removeCollab = async (id: string) => {
    if (!confirm('Retirer ce collaborateur ?')) return;
    const res = await fetch(`/api/admin/collaborators/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Erreur suppression');
      return;
    }
    setCollaborators((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          Tableau de bord
        </h1>
        <p className="mt-1 text-slate-500">Activité commerciale, WhatsApp, catalogue et équipe.</p>
      </div>

      {/* Activité commerciale : CA, marge produits, transport (commandes payées) */}
      <BusinessKpis />

      {/* Activité : WhatsApp, entonnoir, listings, catalogue (période au choix) */}
      <ActivityDashboard />

      {/* Collaborators */}
      <section
        id="collaborators"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="font-display text-lg uppercase tracking-tight text-slate-900 dark:text-white">
                Collaborateurs
              </h3>
              <p className="text-xs text-slate-500">
                Ajoutez les emails des membres de votre équipe.
              </p>
            </div>
          </div>
          <span className="kicker text-slate-400 tabular-nums">{collaborators.length} membre(s)</span>
        </div>

        {/* Invite form */}
        <form
          onSubmit={handleInvite}
          className="border-b border-slate-200 dark:border-slate-700 px-5 py-4 bg-slate-50 dark:bg-slate-900/40"
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@twinsk.com"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="sm:col-span-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Nom
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marie Chen"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Rôle
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
                <option value="viewer">Lecture</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-900 disabled:opacity-60 hover:bg-slate-800 dark:hover:bg-amber-400"
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Inviter
                  </>
                )}
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </form>

        {/* List */}
        {collaborators.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-500">
            <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">Aucun collaborateur encore. Invitez votre équipe ci-dessus.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {collaborators.map((c) => {
              const roleMeta = ROLE_META[c.role];
              const statusMeta = STATUS_META[c.status];
              const RoleIcon = roleMeta.icon;
              const StatusIcon = statusMeta.icon;
              return (
                <li
                  key={c.id}
                  className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 px-5 py-3"
                >
                  <div className="sm:col-span-5 min-w-0">
                    <div className="flex items-center gap-2 truncate text-sm text-slate-900 dark:text-white">
                      <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate font-medium">{c.email}</span>
                    </div>
                    {c.name && (
                      <p className="text-xs text-slate-500 mt-0.5">{c.name}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      value={c.role}
                      onChange={(e) => updateCollab(c.id, { role: e.target.value as Role })}
                      className="w-full rounded-lg border-0 bg-transparent text-xs font-semibold py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Lecture</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${roleMeta.classes}`}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {roleMeta.label}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      onClick={() =>
                        updateCollab(c.id, {
                          status: c.status === 'active' ? 'disabled' : 'active',
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${statusMeta.classes}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusMeta.label}
                    </button>
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      onClick={() => removeCollab(c.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      aria-label="Retirer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
