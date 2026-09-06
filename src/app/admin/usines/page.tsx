'use client';

// Usines — liste des dossiers de classement d'ateliers importés en JSON.
// Même agencement que les listes d'offres B2C / B2B : en-tête + action,
// barre de recherche / tri / dates, tableau, suppression.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Eye,
  Factory,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import FactoryImportModal from '@/components/admin/FactoryImportModal';

interface DossierRow {
  id: string;
  label: string;
  objet: string | null;
  marche_cible: string | null;
  devise: string | null;
  genere_le: string | null;
  factory_count: number;
  ecarte_count: number;
  created_at: string;
  updated_at: string | null;
}

export default function UsinesListPage() {
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [erreur, setErreur] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'usines' | 'label'>('created');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const visible = dossiers
    .filter((d) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const hay = `${d.label} ${d.objet || ''} ${d.marche_cible || ''} ${d.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const j = d.created_at.slice(0, 10);
      if (dateFrom && j < dateFrom) return false;
      if (dateTo && j > dateTo) return false;
      return true;
    })
    .sort((x, y) => {
      if (sortBy === 'label') return x.label.localeCompare(y.label, 'fr');
      if (sortBy === 'usines') return y.factory_count - x.factory_count;
      return y.created_at.localeCompare(x.created_at);
    });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usines');
      const data = await res.json();
      if (Array.isArray(data)) setDossiers(data);
      else setErreur(data?.error || 'Chargement impossible');
    } catch {
      setErreur('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const supprimer = async (d: DossierRow) => {
    if (!window.confirm(`Supprimer « ${d.label} » et ses ${d.factory_count} usine(s) ?`)) return;
    const res = await fetch(`/api/usines/${d.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Erreur suppression');
      return;
    }
    setDossiers((prev) => prev.filter((x) => x.id !== d.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Usines</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dossiers.length} dossier(s) · classements d’ateliers 1688 importés au format JSON —
            capacité industrielle, fiabilité commerciale, ateliers écartés.
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25"
        >
          <Upload className="h-4 w-4" />
          Importer un JSON
        </motion.button>
      </div>

      {erreur && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {erreur}
        </p>
      )}

      {dossiers.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="min-w-[14rem] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Rechercher
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Objet, marché, libellé…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trier
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created' | 'usines' | 'label')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="created">Importés récemment</option>
              <option value="usines">Nombre d’usines</option>
              <option value="label">Libellé A → Z</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Importés du
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              au
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          {(query || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setDateFrom('');
                setDateTo('');
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Effacer
            </button>
          )}
          <span className="pb-2 text-xs text-slate-500">
            {visible.length} / {dossiers.length}
          </span>
        </div>
      )}

      {!dossiers.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <Factory className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-500">
            Aucun dossier d’usines. Importez un JSON de classement pour commencer.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Dossier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Marché
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Importé
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Usines
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Écartées
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      Aucun dossier ne correspond à la recherche.
                    </td>
                  </tr>
                )}
                {visible.map((d, i) => (
                  <motion.tr
                    key={d.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/usines/${d.id}`}
                        className="font-medium text-slate-900 hover:underline dark:text-white"
                      >
                        {d.label}
                      </Link>
                      {d.objet && d.objet !== d.label && (
                        <p className="line-clamp-1 max-w-md text-xs text-slate-500">{d.objet}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {d.marche_cible ? (
                        <span className="line-clamp-1 max-w-[16rem]">{d.marche_cible}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                      {d.devise && (
                        <span className="ml-1 text-xs text-slate-400">({d.devise})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(d.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {d.genere_le && (
                        <span className="block text-xs text-slate-400">
                          généré le{' '}
                          {new Date(d.genere_le).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">
                      {d.factory_count}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">
                      {d.ecarte_count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/usines/${d.id}`}
                          className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/20"
                          title="Ouvrir le classement"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => supprimer(d)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FactoryImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          load();
        }}
      />
    </div>
  );
}
