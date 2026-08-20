'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { eur } from '@/components/sourcing/ui';

interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  status: string;
  updated_at: string;
  supplier_count: number;
  kpis: {
    consulted: number;
    replied: number;
    responseRate: number;
    bestCostPerSet: number | null;
    quotedCount: number;
  };
  leader: { name: string; score: number | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Consultation en cours',
  decided: 'Décidé',
  archived: 'Archivé',
};

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-amber-50 text-amber-800',
  decided: 'bg-emerald-50 text-emerald-800',
  archived: 'bg-slate-100 text-slate-500',
};

export default function SourcingProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/sourcing/projects');
    if (!res.ok) {
      return res.status === 401
        ? 'Session expirée — reconnectez-vous.'
        : 'Impossible de charger les projets.';
    }
    return (await res.json()) as ProjectRow[];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await load();
      if (cancelled) return;
      if (typeof result === 'string') setError(result);
      else setProjects(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = async () => {
    const result = await load();
    if (typeof result === 'string') setError(result);
    else setProjects(result);
  };

  const create = async () => {
    const title = window.prompt('Titre du projet de sourcing');
    if (!title?.trim()) return;
    setCreating(true);
    const res = await fetch('/api/sourcing/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    setCreating(false);
    if (res.ok) await reload();
    else setError('Création impossible.');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-ink">Sourcing fournisseurs</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Consultations en cours, avancement des réponses et meilleur coût débarqué.
          </p>
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded bg-forest px-3 py-2 text-sm font-medium text-white hover:bg-forest-soft disabled:opacity-60"
        >
          <Plus className="size-4" /> Nouveau projet
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {projects === null && !error && <p className="text-sm text-ink-soft">Chargement…</p>}

      {projects?.length === 0 && (
        <p className="rounded border border-dashed border-line px-4 py-10 text-center text-sm text-ink-soft">
          Aucun projet de sourcing. Créez-en un pour ouvrir une consultation fournisseurs.
        </p>
      )}

      {projects && projects.length > 0 && (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Projet</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 text-right font-medium">Panel</th>
                <th className="px-3 py-2 text-right font-medium">Réponses</th>
                <th className="px-3 py-2 text-right font-medium">Meilleur coût</th>
                <th className="px-3 py-2 font-medium">En tête</th>
                <th className="px-3 py-2 text-right font-medium">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-mist/60">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/sourcing/${p.slug}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {p.title}
                    </Link>
                    {p.client && <span className="ml-2 text-xs text-ink-soft">{p.client}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                        STATUS_TONE[p.status] ?? STATUS_TONE.draft
                      }`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{p.supplier_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {p.kpis.consulted > 0 ? (
                      <>
                        {Math.round(p.kpis.responseRate)} %
                        <span className="ml-1 text-xs text-ink-soft">
                          ({p.kpis.replied}/{p.kpis.consulted})
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-soft/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">
                    {p.kpis.bestCostPerSet != null ? (
                      eur(p.kpis.bestCostPerSet)
                    ) : (
                      <span className="text-ink-soft/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {p.leader ? (
                      <>
                        {p.leader.name}
                        {p.leader.score != null && (
                          <span className="ml-1.5 text-xs text-ink-soft">
                            {Math.round(p.leader.score)}/100
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-soft/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-ink-soft">
                    {new Date(p.updated_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
