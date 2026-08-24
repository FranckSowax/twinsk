'use client';

// Panneau « Playbook » : rituels de la semaine + générateur du récap catalogue
// (repost du vendredi), envoyé vers le sous-groupe choisi.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, Loader2, Send } from 'lucide-react';
import { buildRecapMessage, RITUALS } from '@/lib/playbook';
import type { CommunityState, DestOption } from './types';

interface OfferRow {
  id: string;
  title: string;
  status: string;
  offer_type?: string | null;
  archived_at?: string | null;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';
}

export default function PlaybookPanel({
  destOptions,
  community,
}: {
  destOptions: DestOption[];
  community: CommunityState | null;
}) {
  const [lastDone, setLastDone] = useState<Record<string, { done_at: string }>>({});
  const [markingRitual, setMarkingRitual] = useState<string | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeArchived, setIncludeArchived] = useState(false);
  const [recapText, setRecapText] = useState('');
  const [recapEdited, setRecapEdited] = useState(false);
  const [recapGroup, setRecapGroup] = useState('');
  const [recapSending, setRecapSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Destination par défaut du récap : 🛍️ Offres si configuré.
  useEffect(() => {
    setRecapGroup((g) => g || community?.slots.offers || '');
  }, [community]);

  const loadLog = useCallback(async () => {
    const res = await fetch('/api/playbook/log');
    if (res.ok) {
      const d = await res.json();
      if (d.last) setLastDone(d.last);
    }
  }, []);

  useEffect(() => {
    loadLog();
    (async () => {
      const res = await fetch('/api/offers');
      const data = await res.json();
      if (Array.isArray(data)) setOffers(data);
    })();
  }, [loadLog]);

  const todayIso = ((new Date().getDay() + 6) % 7) + 1;
  const isDoneRecently = (key: string, day: number | 'monthly') => {
    const last = lastDone[key];
    if (!last) return false;
    const doneAt = new Date(last.done_at);
    const now = new Date();
    if (day === 'monthly') {
      return doneAt.getMonth() === now.getMonth() && doneAt.getFullYear() === now.getFullYear();
    }
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return doneAt >= monday;
  };

  const markRitual = async (key: string) => {
    setMarkingRitual(key);
    try {
      await fetch('/api/playbook/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ritual: key }),
      });
      loadLog();
    } finally {
      setMarkingRitual(null);
    }
  };

  const eligibleOffers = useMemo(
    () =>
      offers.filter((o) =>
        includeArchived ? o.status === 'published' : o.status === 'published' && !o.archived_at,
      ),
    [offers, includeArchived],
  );

  const generatedRecap = useMemo(() => {
    const items = eligibleOffers
      .filter((o) => selected.has(o.id))
      .map((o) => ({
        title: o.title,
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/offer/${o.id}`,
      }));
    return items.length ? buildRecapMessage(items) : '';
  }, [eligibleOffers, selected]);

  useEffect(() => {
    if (!recapEdited) setRecapText(generatedRecap);
  }, [generatedRecap, recapEdited]);

  const toggleOffer = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyRecap = async () => {
    try {
      await navigator.clipboard.writeText(recapText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiez :', recapText);
    }
  };

  const sendRecap = async () => {
    if (!recapText.trim()) return;
    setRecapSending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/playbook/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: recapText, group_id: recapGroup || undefined }),
      });
      const d = await res.json();
      setMsg(res.ok ? '✅ Récap envoyé — pensez à l’épingler 📌 (30 jours)' : `❌ ${d.error}`);
      if (res.ok) loadLog();
    } finally {
      setRecapSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Rituels */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Rituels de la semaine</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {RITUALS.map((r) => {
            const isToday = r.day === todayIso || (r.day === 'monthly' && new Date().getDate() === 1);
            const done = isDoneRecently(r.key, r.day);
            const dayLabel = r.day === 'monthly' ? '1ᵉʳ du mois' : ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][r.day];
            return (
              <div
                key={r.key}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  isToday && !done
                    ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-900/20'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <span className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isToday ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                  {dayLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.label}</p>
                  <p className="text-[11px] text-slate-500">{r.hint}</p>
                  {lastDone[r.key] && (
                    <p className="mt-0.5 text-[10px] text-slate-400">Dernier : {fmtDate(lastDone[r.key].done_at)}</p>
                  )}
                </div>
                <button
                  onClick={() => markRitual(r.key)}
                  disabled={markingRitual === r.key}
                  title={done ? 'Fait — recliquer pour re-tracer' : 'Marquer fait'}
                  className={`rounded-lg p-1.5 ${done ? 'text-emerald-500' : 'text-slate-300 hover:bg-slate-100 hover:text-emerald-500 dark:hover:bg-slate-700'}`}
                >
                  {markingRitual === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Récap catalogue */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Récap catalogue — repost des liens</h2>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Inclure les archivés
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-slate-500">Listings à inclure ({selected.size}/10 max) :</p>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2 dark:border-slate-700">
              {eligibleOffers.length === 0 ? (
                <p className="p-2 text-sm text-slate-400">Aucun listing publié.</p>
              ) : (
                eligibleOffers.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleOffer(o.id)}
                      disabled={!selected.has(o.id) && selected.size >= 10}
                      className="h-4 w-4 rounded"
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{o.title}</span>
                    {(o.offer_type ?? 'b2c') === 'b2b' && <span className="rounded bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">B2B</span>}
                    {o.archived_at && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">archivé</span>}
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <textarea
              value={recapText}
              onChange={(e) => { setRecapText(e.target.value); setRecapEdited(true); }}
              rows={9}
              placeholder="Le message se génère quand vous cochez des listings…"
              className={`${inputCls} flex-1 font-mono text-xs leading-relaxed`}
            />
            <div className="flex flex-wrap items-center gap-2">
              {recapEdited && (
                <button onClick={() => { setRecapEdited(false); setRecapText(generatedRecap); }} className="text-[11px] font-semibold text-slate-400 underline">
                  Régénérer
                </button>
              )}
              <select value={recapGroup} onChange={(e) => setRecapGroup(e.target.value)} className={`${inputCls} max-w-[220px] flex-1`}>
                {destOptions.map((o) => (
                  <option key={o.id || 'default'} value={o.id}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={copyRecap}
                disabled={!recapText.trim()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
              <button
                onClick={sendRecap}
                disabled={recapSending || !recapText.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {recapSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Envoyer
              </button>
            </div>
            {msg && <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{msg}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
