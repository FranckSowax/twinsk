'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileJson, Loader2, Copy, Download, Trash2, X, Check } from 'lucide-react';

interface ImportRow {
  id: string;
  created_at: string;
  label: string | null;
  product_count: number | null;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function JsonImportsButton({
  targetType,
  targetId,
  isAdmin = false,
}: {
  targetType: 'offer' | 'request';
  targetId: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/json-imports?target_type=${targetType}&target_id=${targetId}`);
      const data = await res.json();
      if (Array.isArray(data.imports)) {
        setRows(data.imports);
        setCount(data.imports.length);
      }
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  // Compte au montage (pour le badge).
  useEffect(() => {
    load();
  }, [load]);

  const fetchPayload = async (id: string): Promise<string | null> => {
    const res = await fetch(`/api/json-imports/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.stringify(data.payload, null, 2);
  };

  const copyOne = async (id: string) => {
    setBusy(id);
    try {
      const json = await fetchPayload(id);
      if (json) {
        await navigator.clipboard.writeText(json);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1600);
      }
    } finally {
      setBusy(null);
    }
  };

  const downloadOne = async (row: ImportRow) => {
    setBusy(row.id);
    try {
      const json = await fetchPayload(row.id);
      if (!json) return;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(row.label || 'import').replace(/[^\w.-]+/g, '_')}-${row.id.slice(0, 6)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  const copyAll = async () => {
    setBusy('all');
    try {
      const payloads: unknown[] = [];
      for (const r of rows) {
        const res = await fetch(`/api/json-imports/${r.id}`);
        if (res.ok) payloads.push((await res.json()).payload);
      }
      await navigator.clipboard.writeText(JSON.stringify(payloads, null, 2));
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 1600);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Supprimer ce JSON sauvegardé ?')) return;
    setBusy(id);
    try {
      await fetch(`/api/json-imports/${id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== id));
      setCount((c) => (c != null ? c - 1 : c));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); load(); }}
        title="JSON importés (réutilisables)"
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
      >
        <FileJson className="h-4 w-4" />
        JSON importés
        {count != null && count > 0 && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{count}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-emerald-500" />
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">JSON importés</h2>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                Copie des JSON importés sur cette {targetType === 'offer' ? 'offre' : 'demande'} — réutilisez-les pour une autre commande.
              </p>

              {loading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
              ) : rows.length === 0 ? (
                <p className="py-6 text-sm text-slate-400">Aucun JSON importé pour le moment.</p>
              ) : (
                <>
                  {rows.length > 1 && (
                    <button
                      onClick={copyAll}
                      disabled={busy === 'all'}
                      className="mb-3 flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-slate-700"
                    >
                      {busy === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : copiedId === 'all' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedId === 'all' ? 'Copié !' : `Copier tout (${rows.length})`}
                    </button>
                  )}
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{r.label || 'Import JSON'}</p>
                          <p className="text-[11px] text-slate-400">
                            {fmtDate(r.created_at)}{r.product_count != null ? ` · ${r.product_count} produit(s)` : ''}
                          </p>
                        </div>
                        <button onClick={() => copyOne(r.id)} disabled={busy === r.id} title="Copier le JSON" className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : copiedId === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedId === r.id ? 'Copié' : 'Copier'}
                        </button>
                        <button onClick={() => downloadOne(r)} disabled={busy === r.id} title="Télécharger le .json" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => remove(r.id)} disabled={busy === r.id} title="Supprimer" className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-60">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
