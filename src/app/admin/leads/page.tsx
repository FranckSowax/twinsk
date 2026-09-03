'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Inbox,
  Loader2,
  Search,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  Ban,
  CircleDot,
  PackageSearch,
  Zap,
  Car,
  Users,
  Youtube,
  Filter,
  Ship,
} from 'lucide-react';
import { describeTouchPoint, type Attribution } from '@/lib/attribution';

type LeadType =
  | 'freight_estimate'
  | 'sampling'
  | 'quick_quote'
  | 'cars_import'
  | 'delegation'
  | 'youtube_shop';

type LeadStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

interface Lead {
  id: string;
  type: LeadType;
  fields: Record<string, string | number>;
  status: LeadStatus;
  admin_note: string | null;
  attribution: Attribution | null;
  created_at: string;
  updated_at: string;
}

const TYPE_META: Record<
  LeadType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  freight_estimate: { label: 'Fret', icon: Ship, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' },
  sampling: { label: 'Échantillon', icon: PackageSearch, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  quick_quote: { label: 'Cotation', icon: Zap, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
  cars_import: { label: 'Voiture', icon: Car, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' },
  delegation: { label: 'Délégation', icon: Users, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' },
  youtube_shop: { label: 'YouTube', icon: Youtube, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
};

const STATUS_META: Record<
  LeadStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }
> = {
  new: {
    label: 'Nouveau',
    icon: CircleDot,
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  in_progress: {
    label: 'En cours',
    icon: Clock,
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  done: {
    label: 'Traité',
    icon: CheckCircle2,
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  cancelled: {
    label: 'Annulé',
    icon: Ban,
    classes: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  },
};

const STATUS_ORDER: LeadStatus[] = ['new', 'in_progress', 'done', 'cancelled'];
const TYPE_ORDER: LeadType[] = [
  'freight_estimate',
  'sampling',
  'quick_quote',
  'cars_import',
  'delegation',
  'youtube_shop',
];

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<LeadType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Lead | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/leads')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setLeads(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const byStatus: Record<LeadStatus, number> = { new: 0, in_progress: 0, done: 0, cancelled: 0 };
    leads.forEach((l) => {
      byStatus[l.status]++;
    });
    return byStatus;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterType !== 'all' && l.type !== filterType) return false;
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      if (!q) return true;
      const blob =
        JSON.stringify(l.fields).toLowerCase() + ' ' + (l.admin_note ?? '').toLowerCase();
      return blob.includes(q);
    });
  }, [leads, filterType, filterStatus, search]);

  const updateLead = async (
    id: string,
    patch: Partial<Pick<Lead, 'status' | 'admin_note'>>,
  ) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert('Erreur mise à jour');
      return;
    }
    const updated = await res.json();
    setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    if (active?.id === id) setActive(updated);
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Supprimer définitivement cette demande ?')) return;
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Erreur suppression');
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (active?.id === id) setActive(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Demandes services
          </h1>
          <p className="mt-1 text-slate-500">
            {leads.length} demande(s) reçue(s) — {counts.new} nouvelle(s)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {STATUS_ORDER.map((s) => {
            const m = STATUS_META[s];
            const Icon = m.icon;
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${m.classes}`}
              >
                <Icon className="h-3 w-3" />
                {counts[s]} {m.label.toLowerCase()}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, email, contenu, note)…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Filter className="h-3 w-3" /> Type
            </span>
            <FilterPill active={filterType === 'all'} onClick={() => setFilterType('all')}>
              Tous
            </FilterPill>
            {TYPE_ORDER.map((t) => (
              <FilterPill key={t} active={filterType === t} onClick={() => setFilterType(t)}>
                {TYPE_META[t].label}
              </FilterPill>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Filter className="h-3 w-3" /> Statut
            </span>
            <FilterPill active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>
              Tous
            </FilterPill>
            {STATUS_ORDER.map((s) => (
              <FilterPill key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)}>
                {STATUS_META[s].label}
              </FilterPill>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Inbox className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-sm">Aucune demande ne correspond à ce filtre.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Aperçu</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Reçu</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="w-10 px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((lead) => {
                  const meta = TYPE_META[lead.type];
                  const Icon = meta.icon;
                  const status = STATUS_META[lead.status];
                  const StatusIcon = status.icon;
                  const preview = previewLead(lead);
                  const contact = String(lead.fields.Contact ?? lead.fields.contact ?? '');
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setActive(lead)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                        lead.status === 'new' ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-1">
                          {preview}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {contact || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(lead.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.classes}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLead(lead.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <DetailModal
          lead={active}
          onClose={() => setActive(null)}
          onUpdate={updateLead}
          onDelete={deleteLead}
        />
      )}
    </div>
  );
}

const FilterPill = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'bg-slate-900 text-white dark:bg-amber-500'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
    }`}
  >
    {children}
  </button>
);

const DetailModal = ({
  lead,
  onClose,
  onUpdate,
  onDelete,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Pick<Lead, 'status' | 'admin_note'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [note, setNote] = useState(lead.admin_note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const meta = TYPE_META[lead.type];
  const Icon = meta.icon;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
            </span>
            <span className="text-sm text-slate-500">{formatFull(lead.created_at)}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/40">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Détail de la demande
            </p>
            <dl className="space-y-2">
              {Object.entries(lead.fields).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-3 text-sm">
                  <dt className="font-medium text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="col-span-2 text-slate-900 dark:text-white break-words">
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <AttributionBlock attribution={lead.attribution} />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Statut
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => {
                const m = STATUS_META[s];
                const SIcon = m.icon;
                const active = lead.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => onUpdate(lead.id, { status: s })}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? m.classes + ' ring-2 ring-offset-1 ring-current'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <SIcon className="h-3 w-3" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Note interne
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ajouter une note interne (relance, devis envoyé, etc.)"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <button
              onClick={async () => {
                setSavingNote(true);
                await onUpdate(lead.id, { admin_note: note || null });
                setSavingNote(false);
              }}
              disabled={savingNote || note === (lead.admin_note ?? '')}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-amber-500"
            >
              {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Enregistrer la note
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            onClick={() => onDelete(lead.id)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

function previewLead(lead: Lead): string {
  const f = lead.fields;
  if (lead.type === 'freight_estimate') {
    return `${f.Mode ?? '?'} → ${f.Destination ?? '?'} • ${f['Estimation (USD)'] ?? '?'} USD`;
  }
  if (lead.type === 'sampling') return String(f.Produit ?? 'Échantillon');
  if (lead.type === 'quick_quote') return String(f.Projet ?? 'Cotation projet');
  if (lead.type === 'cars_import')
    return String(f['Modèle'] ?? f.Origine ?? 'Import véhicule');
  if (lead.type === 'delegation')
    return `${f.Organisation ?? '?'} • ${f.Objectif ?? '?'}`;
  if (lead.type === 'youtube_shop')
    return `${f['Vidéo'] ?? '?'} • ${f.Produit ?? '?'}`;
  return Object.values(f).slice(0, 2).join(' • ');
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Provenance du lead : d'où vient la personne, et par quelle campagne.
 * `first` = la source qui l'a fait découvrir Twinsk, `last` = celle du jour
 * où elle a rempli le formulaire. Les deux diffèrent dès qu'il y a relance.
 */
function AttributionBlock({ attribution }: { attribution: Attribution | null }) {
  if (!attribution) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/40">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Provenance
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Non tracée — lead antérieur à la mise en place du suivi, ou visite directe.
        </p>
      </div>
    );
  }

  const { first, last } = attribution;
  const sameTouch = describeTouchPoint(first) === describeTouchPoint(last);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/40">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Provenance
      </p>
      <dl className="space-y-2 text-sm">
        <div className="grid grid-cols-3 gap-3">
          <dt className="font-medium text-slate-500 dark:text-slate-400">
            {sameTouch ? 'Source' : 'Découverte'}
          </dt>
          <dd className="col-span-2 font-semibold text-slate-900 dark:text-white break-words">
            {describeTouchPoint(first)}
          </dd>
        </div>
        {!sameTouch && (
          <div className="grid grid-cols-3 gap-3">
            <dt className="font-medium text-slate-500 dark:text-slate-400">Dernier contact</dt>
            <dd className="col-span-2 font-semibold text-slate-900 dark:text-white break-words">
              {describeTouchPoint(last)}
            </dd>
          </div>
        )}
        {last.utm_content && (
          <div className="grid grid-cols-3 gap-3">
            <dt className="font-medium text-slate-500 dark:text-slate-400">Créa</dt>
            <dd className="col-span-2 text-slate-900 dark:text-white break-words">
              {last.utm_content}
            </dd>
          </div>
        )}
        {last.landing_path && (
          <div className="grid grid-cols-3 gap-3">
            <dt className="font-medium text-slate-500 dark:text-slate-400">Page d’entrée</dt>
            <dd className="col-span-2 text-slate-900 dark:text-white break-words">
              {last.landing_path}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
