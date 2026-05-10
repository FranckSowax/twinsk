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
  FileText,
  Filter,
  Ship,
  Plane,
  Link as LinkIcon,
  ExternalLink,
  Copy,
} from 'lucide-react';

type Mode = 'sea' | 'air';
type SeaService = 'lcl' | 'fcl20' | 'fcl40' | null;
type Status = 'draft' | 'submitted' | 'processing' | 'quoted' | 'completed' | 'cancelled';

interface FreightRequest {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  mode: Mode;
  sea_service: SeaService;
  origin: string;
  destination: string;
  weight: number;
  volume: number;
  goods_nature: string;
  goods_description: string;
  photos: string[];
  estimated_price: number;
  estimated_days: number;
  status: Status;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_META: Record<
  Status,
  { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }
> = {
  draft: {
    label: 'Brouillon',
    icon: CircleDot,
    classes: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  submitted: {
    label: 'Envoyée',
    icon: FileText,
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  processing: {
    label: 'En cours',
    icon: Clock,
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  quoted: {
    label: 'Devisée',
    icon: CheckCircle2,
    classes: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  completed: {
    label: 'Terminée',
    icon: CheckCircle2,
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  cancelled: {
    label: 'Annulée',
    icon: Ban,
    classes: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  },
};

const STATUS_ORDER: Status[] = [
  'draft',
  'submitted',
  'processing',
  'quoted',
  'completed',
  'cancelled',
];

export default function AdminFreightPage() {
  const [items, setItems] = useState<FreightRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<FreightRequest | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/freight-requests')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const out: Record<Status, number> = {
      draft: 0,
      submitted: 0,
      processing: 0,
      quoted: 0,
      completed: 0,
      cancelled: 0,
    };
    items.forEach((i) => {
      out[i.status]++;
    });
    return out;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filterStatus !== 'all' && i.status !== filterStatus) return false;
      if (!q) return true;
      const blob = `${i.client_name} ${i.client_email} ${i.client_phone} ${i.destination} ${i.goods_nature} ${i.goods_description} ${i.admin_notes ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [items, filterStatus, search]);

  const updateRow = async (
    id: string,
    patch: Partial<Pick<FreightRequest, 'status' | 'admin_notes'>>,
  ) => {
    const res = await fetch(`/api/freight-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert('Erreur mise à jour');
      return;
    }
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    if (active?.id === id) setActive(updated);
  };

  const deleteRow = async (id: string) => {
    if (!confirm('Supprimer définitivement cette demande ?')) return;
    const res = await fetch(`/api/freight-requests/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Erreur suppression');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (active?.id === id) setActive(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Demandes de fret
          </h1>
          <p className="mt-1 text-slate-500">
            {items.length} demande(s) — {counts.submitted} à traiter
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
              placeholder="Rechercher (client, destination, marchandise…)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Filter className="h-3 w-3" /> Statut
            </span>
            <FilterPill active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>
              Tous
            </FilterPill>
            {STATUS_ORDER.map((s) => (
              <FilterPill
                key={s}
                active={filterStatus === s}
                onClick={() => setFilterStatus(s)}
              >
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
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Marchandise</th>
                  <th className="px-4 py-3 text-right">Poids · Vol.</th>
                  <th className="px-4 py-3">Reçu</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="w-10 px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((row) => {
                  const status = STATUS_META[row.status];
                  const StatusIcon = status.icon;
                  const ModeIcon = row.mode === 'air' ? Plane : Ship;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setActive(row)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                        row.status === 'submitted' ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {row.client_name || <span className="text-slate-400">—</span>}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-[180px]">
                          {row.client_email || row.client_phone}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        <div className="inline-flex items-center gap-1.5">
                          <ModeIcon className="h-4 w-4 text-slate-400" />
                          {row.mode === 'air'
                            ? 'Aérien'
                            : `${row.sea_service?.toUpperCase() ?? 'Maritime'}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {row.destination || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                        {row.goods_nature || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        {row.weight ? `${row.weight} kg` : '—'}
                        <br />
                        {row.volume ? `${row.volume} m³` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(row.created_at)}
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
                            deleteRow(row.id);
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
          row={active}
          onClose={() => setActive(null)}
          onUpdate={updateRow}
          onDelete={deleteRow}
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
  row,
  onClose,
  onUpdate,
  onDelete,
}: {
  row: FreightRequest;
  onClose: () => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<FreightRequest, 'status' | 'admin_notes'>>,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [note, setNote] = useState(row.admin_notes ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [copied, setCopied] = useState(false);

  const clientLink =
    typeof window !== 'undefined' ? `${window.location.origin}/freight/${row.id}` : '';

  const copyLink = () => {
    if (!clientLink) return;
    navigator.clipboard.writeText(clientLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-8 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Fret {row.mode === 'air' ? 'Aérien' : `Maritime · ${row.sea_service?.toUpperCase()}`}
            </p>
            <h3 className="font-display text-xl uppercase tracking-tight text-slate-900 dark:text-white mt-1">
              {row.client_name || 'Sans nom'} · {row.destination || '—'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 max-h-[70vh] overflow-y-auto">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/40 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Info label="Email">{row.client_email || '—'}</Info>
            <Info label="WhatsApp">{row.client_phone || '—'}</Info>
            <Info label="Poids">{row.weight ? `${row.weight} kg` : '—'}</Info>
            <Info label="Volume">{row.volume ? `${row.volume} m³` : '—'}</Info>
            <Info label="Estimation">
              {row.estimated_price ? `$${row.estimated_price.toLocaleString('en-US')}` : '—'}
            </Info>
            <Info label="Délai estimé">
              {row.estimated_days ? `${row.estimated_days} j` : '—'}
            </Info>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Marchandise
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {row.goods_nature || <span className="text-slate-400">Non spécifiée</span>}
            </p>
            {row.goods_description && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {row.goods_description}
              </p>
            )}
          </div>

          {row.photos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Photos ({row.photos.length})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {row.photos.map((url, i) => (
                  <a
                    key={url + i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 hover:opacity-90"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/40">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Lien client
              </p>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700"
              >
                {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <a
              href={`/freight/${row.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-mono text-slate-700 dark:text-slate-300 hover:text-amber-600 break-all"
            >
              <LinkIcon className="h-3 w-3 flex-shrink-0" />
              {clientLink}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Statut
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => {
                const m = STATUS_META[s];
                const SIcon = m.icon;
                const active = row.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => onUpdate(row.id, { status: s })}
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
              placeholder="Devis envoyé, relance, suivi…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <button
              onClick={async () => {
                setSavingNote(true);
                await onUpdate(row.id, { admin_notes: note || null });
                setSavingNote(false);
              }}
              disabled={savingNote || note === (row.admin_notes ?? '')}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-amber-500"
            >
              {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Enregistrer la note
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            onClick={() => onDelete(row.id)}
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

const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</p>
    <p className="text-sm font-medium text-slate-900 dark:text-white tabular-nums truncate">
      {children}
    </p>
  </div>
);

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
