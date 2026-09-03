'use client';

// Choix du périmètre avant publication au catalogue WhatsApp Business.
// Le catalogue est une vitrine (500 fiches max, tous listings confondus) :
// une collection par phase, le premier produit de chaque catégorie. On coche
// les phases qui doivent partir au catalogue.

import { useEffect, useState } from 'react';
import { Loader2, Store, X } from 'lucide-react';

interface Group {
  id: string;
  title: string;
  categories: number;
  fiches: number;
}

const CATALOG_CAP = 500;

interface Props {
  offerId: string;
  offerTitle: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function CatalogScopeModal({ offerId, offerTitle, onClose, onDone }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupedBy, setGroupedBy] = useState<'phase' | 'listing'>('phase');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/offers/${offerId}/catalog-sync`);
        const d = await res.json();
        if (!res.ok) {
          setError(d.error || 'Lecture du listing impossible');
          return;
        }
        setGroups(d.groups || []);
        setGroupedBy(d.grouped_by || 'phase');
      } catch {
        setError('Erreur réseau');
      } finally {
        setLoading(false);
      }
    })();
  }, [offerId]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const fiches = groups.filter((g) => selected.has(g.id)).reduce((n, g) => n + g.fiches, 0);
  // Une collection par groupe coché (phase, ou listing entier).
  const collections = selected.size;
  const minutes = Math.max(1, Math.round(((fiches + collections * 2) * 0.4) / 60));
  const overCap = fiches > CATALOG_CAP;

  const publish = async (mode: 'full' | 'collections' = 'full') => {
    if (!selected.size) return;
    setSyncing(true);
    setError('');
    try {
      const res = await fetch(`/api/offers/${offerId}/catalog-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: window.location.origin,
          mode,
          groupIds: [...selected],
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Échec de la synchro');
        return;
      }
      onDone(
        `✅ Catalogue WhatsApp à jour\n` +
          (mode === 'collections'
            ? `${d.collections?.length || 0} collection(s) reconstruite(s)`
            : `${d.created} fiche(s) créée(s) · ${d.updated} mise(s) à jour`) +
          (d.skipped ? ` · ${d.skipped} ignorée(s)` : '') +
          (d.duplicates ? ` · ${d.duplicates} fantôme(s)` : '') +
          (d.collections?.length ? `\n${d.collections.length} collection(s)` : '') +
          (d.errors?.length ? `\n⚠️ ${d.errors.join('\n')}` : ''),
      );
    } catch {
      setError('Erreur réseau');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Publier au catalogue WhatsApp
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {offerTitle} —{' '}
              {groupedBy === 'phase'
                ? 'une collection par phase, le premier produit de chaque catégorie'
                : 'une collection pour le listing, le premier produit de chaque catégorie'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#25D366]" />
            </div>
          ) : error && !groups.length ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div className="mb-3 flex gap-2 text-xs">
                <button
                  onClick={() => setSelected(new Set(groups.map((g) => g.id)))}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                >
                  Tout cocher
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                >
                  Tout décocher
                </button>
              </div>
              <ul className="space-y-1.5">
                {groups.map((g) => (
                  <li key={g.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/50">
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        onChange={() => toggle(g.id)}
                        className="h-4 w-4 rounded accent-[#25D366]"
                      />
                      <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {g.title}
                      </span>
                      <span className="text-xs tabular-nums text-slate-400">
                        {g.fiches} fiche{g.fiches > 1 ? 's' : ''} · {g.categories} cat.
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 p-5 dark:border-slate-700">
          {error && groups.length > 0 && (
            <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className={overCap ? 'font-semibold text-red-600' : 'text-slate-500'}>
              {fiches
                ? `${fiches} fiche(s) · ${collections} collection(s) · ~${minutes} min` +
                  (overCap ? ` — dépasse le plafond WhatsApp de ${CATALOG_CAP} fiches` : '')
                : 'Rien de sélectionné'}
            </span>
          </div>
          <button
            onClick={() => publish('full')}
            disabled={!selected.size || syncing || overCap}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            {syncing ? 'Publication en cours…' : 'Publier au catalogue'}
          </button>
          <button
            onClick={() => publish('collections')}
            disabled={!selected.size || syncing}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
            title="Regroupe les fiches déjà publiées en collections, sans les recréer"
          >
            Reconstruire seulement les collections
          </button>
          {syncing && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Ne fermez pas cette fenêtre — environ {minutes} min.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
