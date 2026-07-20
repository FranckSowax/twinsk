'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, Save, ChevronUp, ChevronDown, Layers } from 'lucide-react';

export interface OfferPhase {
  id: string;
  title: string;
  position?: number;
}

export default function OfferPhasesPanel({
  offerId,
  phases,
  onChanged,
}: {
  offerId: string;
  phases: OfferPhase[];
  onChanged: () => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const add = async () => {
    setBusy('add');
    try {
      await fetch(`/api/offers/${offerId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      setNewTitle('');
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const rename = async (id: string) => {
    const title = drafts[id];
    if (title == null) return;
    setBusy(id);
    try {
      await fetch(`/api/offers/${offerId}/phases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      setDrafts((d) => {
        const n = { ...d };
        delete n[id];
        return n;
      });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Supprimer cette phase ? Les catégories rattachées repassent « sans phase » (produits conservés).')) return;
    setBusy(id);
    try {
      await fetch(`/api/offers/${offerId}/phases/${id}`, { method: 'DELETE' });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= phases.length) return;
    const ids = phases.map((p) => p.id);
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    setBusy('reorder');
    try {
      await fetch(`/api/offers/${offerId}/phases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: ids }),
      });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-800 dark:bg-indigo-900/10">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-indigo-600" />
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Phases</h2>
        <span className="text-xs text-slate-500">— regroupez vos catégories (ex : Phase 1 — Rénovation)</span>
      </div>

      {phases.length > 0 && (
        <div className="space-y-2">
          {phases.map((p, idx) => {
            const draft = drafts[p.id];
            const dirty = draft != null && draft !== p.title;
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-shrink-0 flex-col">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0 || busy != null} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === phases.length - 1 || busy != null} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <input
                  value={draft ?? p.title}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                {dirty && (
                  <button onClick={() => rename(p.id)} disabled={busy === p.id} className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
                    {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </button>
                )}
                <button onClick={() => remove(p.id)} disabled={busy === p.id} className="flex-shrink-0 rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && add()}
          placeholder="Nom de la phase (ex : Phase 2 — Aménagement)"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button onClick={add} disabled={busy === 'add' || !newTitle.trim()} className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter une phase
        </button>
      </div>
    </div>
  );
}
