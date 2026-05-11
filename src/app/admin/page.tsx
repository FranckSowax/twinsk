'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Ship,
  Inbox,
  Users,
  TrendingUp,
  Loader2,
  UserPlus,
  Trash2,
  Mail,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  Ban,
  Shield,
  Eye,
  UserCog,
} from 'lucide-react';

type Role = 'admin' | 'agent' | 'viewer';
type CollabStatus = 'invited' | 'active' | 'disabled';

interface Stats {
  requests: { total: number; byStatus: Record<string, number>; last7d: number; active: number };
  freight: { total: number; byStatus: Record<string, number>; last7d: number; active: number };
  leads: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    last7d: number;
    new: number;
  };
  collaborators: { total: number; byStatus: Record<string, number> };
}

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
  const [stats, setStats] = useState<Stats | null>(null);
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
      const [s, c] = await Promise.all([
        fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/admin/collaborators').then((r) => (r.ok ? r.json() : [])),
      ]);
      setStats(s);
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
        <p className="mt-1 text-slate-500">Vue d&apos;ensemble des demandes, services et équipe.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Package}
          label="Sourcing"
          value={stats?.requests.total ?? 0}
          delta={stats?.requests.last7d ?? 0}
          deltaLabel="7 derniers j."
          active={stats?.requests.active ?? 0}
          activeLabel="à traiter"
          href="/admin/requests"
          tone="amber"
        />
        <KpiCard
          icon={Ship}
          label="Fret"
          value={stats?.freight.total ?? 0}
          delta={stats?.freight.last7d ?? 0}
          deltaLabel="7 derniers j."
          active={stats?.freight.active ?? 0}
          activeLabel="à traiter"
          href="/admin/freight"
          tone="cyan"
        />
        <KpiCard
          icon={Inbox}
          label="Services"
          value={stats?.leads.total ?? 0}
          delta={stats?.leads.last7d ?? 0}
          deltaLabel="7 derniers j."
          active={stats?.leads.new ?? 0}
          activeLabel="nouvelles"
          href="/admin/leads"
          tone="violet"
        />
        <KpiCard
          icon={Users}
          label="Équipe"
          value={stats?.collaborators.total ?? 0}
          delta={stats?.collaborators.byStatus.active ?? 0}
          deltaLabel="actifs"
          active={stats?.collaborators.byStatus.invited ?? 0}
          activeLabel="invités"
          href="#collaborators"
          tone="emerald"
        />
      </div>

      {/* Activity breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ActivityBlock
          title="Sourcing"
          icon={Package}
          tone="amber"
          href="/admin/requests"
          stats={[
            { label: 'Brouillon', value: stats?.requests.byStatus.draft ?? 0, icon: CircleDot },
            { label: 'Envoyée', value: stats?.requests.byStatus.submitted ?? 0, icon: Clock },
            { label: 'En cours', value: stats?.requests.byStatus.processing ?? 0, icon: Clock },
            { label: 'Devisée', value: stats?.requests.byStatus.quoted ?? 0, icon: CheckCircle2 },
            { label: 'Terminée', value: stats?.requests.byStatus.completed ?? 0, icon: CheckCircle2 },
          ]}
        />
        <ActivityBlock
          title="Fret"
          icon={Ship}
          tone="cyan"
          href="/admin/freight"
          stats={[
            { label: 'Brouillon', value: stats?.freight.byStatus.draft ?? 0, icon: CircleDot },
            { label: 'Envoyée', value: stats?.freight.byStatus.submitted ?? 0, icon: Clock },
            { label: 'En cours', value: stats?.freight.byStatus.processing ?? 0, icon: Clock },
            { label: 'Devisée', value: stats?.freight.byStatus.quoted ?? 0, icon: CheckCircle2 },
            { label: 'Terminée', value: stats?.freight.byStatus.completed ?? 0, icon: CheckCircle2 },
          ]}
        />
        <ActivityBlock
          title="Services"
          icon={Inbox}
          tone="violet"
          href="/admin/leads"
          stats={[
            { label: 'Nouveau', value: stats?.leads.byStatus.new ?? 0, icon: CircleDot },
            { label: 'En cours', value: stats?.leads.byStatus.in_progress ?? 0, icon: Clock },
            { label: 'Traité', value: stats?.leads.byStatus.done ?? 0, icon: CheckCircle2 },
            { label: 'Annulé', value: stats?.leads.byStatus.cancelled ?? 0, icon: Ban },
          ]}
        />
      </div>

      {/* Leads breakdown by type */}
      {stats?.leads && Object.keys(stats.leads.byType).length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg uppercase tracking-tight text-slate-900 dark:text-white">
              Services par type
            </h3>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(stats.leads.byType).map(([type, count]) => (
              <div
                key={type}
                className="rounded-xl bg-slate-50 dark:bg-slate-900/40 px-4 py-3"
              >
                <div className="text-xs text-slate-500 capitalize">{prettifyLeadType(type)}</div>
                <div className="mt-1 font-display text-2xl tabular-nums text-slate-900 dark:text-white">
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  delta: number;
  deltaLabel: string;
  active: number;
  activeLabel: string;
  href: string;
  tone: 'amber' | 'cyan' | 'violet' | 'emerald';
}

const TONE_RING: Record<KpiCardProps['tone'], string> = {
  amber: 'from-amber-50 to-orange-50 text-amber-600',
  cyan: 'from-cyan-50 to-blue-50 text-cyan-600',
  violet: 'from-violet-50 to-purple-50 text-violet-600',
  emerald: 'from-emerald-50 to-teal-50 text-emerald-600',
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  active,
  activeLabel,
  href,
  tone,
}: KpiCardProps) => (
  <Link
    href={href}
    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow dark:border-slate-700 dark:bg-slate-800"
  >
    <div
      className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${TONE_RING[tone]} blur-2xl opacity-40 -translate-y-1/2 translate-x-1/2 pointer-events-none`}
    />
    <div className="relative">
      <div className="flex items-center justify-between">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TONE_RING[tone]} flex items-center justify-center`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
      <p className="kicker mt-4 text-slate-500">{label}</p>
      <div className="mt-1 font-display text-4xl tabular-nums font-bold text-slate-900 dark:text-white">
        {value}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className="text-slate-500">
          <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
            {delta}
          </span>{' '}
          {deltaLabel}
        </span>
        {active > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 font-medium dark:bg-amber-900/20 dark:text-amber-300">
            <span className="tabular-nums">{active}</span> {activeLabel}
          </span>
        )}
      </div>
    </div>
  </Link>
);

interface ActivityBlockProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'amber' | 'cyan' | 'violet';
  href: string;
  stats: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }[];
}

const ActivityBlock = ({ title, icon: Icon, href, stats }: ActivityBlockProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="font-display text-base uppercase tracking-tight text-slate-900 dark:text-white">
          {title}
        </h3>
      </div>
      <Link
        href={href}
        className="text-xs text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
      >
        Voir
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
      {stats.map((s) => {
        const SIcon = s.icon;
        return (
          <li key={s.label} className="flex items-center justify-between px-5 py-2.5">
            <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <SIcon className="h-3.5 w-3.5 text-slate-400" />
              {s.label}
            </span>
            <span className="font-display text-base tabular-nums text-slate-900 dark:text-white">
              {s.value}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);

function prettifyLeadType(type: string): string {
  const map: Record<string, string> = {
    freight_estimate: 'Fret (estim.)',
    sampling: 'Échantillon',
    quick_quote: 'Cotation',
    cars_import: 'Véhicules',
    delegation: 'Délégations',
    youtube_shop: 'YouTube Shop',
  };
  return map[type] || type.replace(/_/g, ' ');
}
