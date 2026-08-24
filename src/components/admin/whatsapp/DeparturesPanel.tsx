'use client';

// Panneau « Départs » : groupes de départ logistique (aérien/maritime), créés
// comme sous-groupes de la communauté quand elle est liée, avec jalons envoyés
// directement dans le groupe.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Link2,
  Loader2,
  MessageCircle,
  Plane,
  Plus,
  Ship,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildOpeningMessage,
  DEPARTURE_KIND_META,
  DEPARTURE_STATUS_META,
  MILESTONES,
  type DepartureKind,
  type DepartureStatus,
} from '@/lib/playbook';
import type { GroupRow } from './types';

interface Departure {
  id: string;
  kind: DepartureKind;
  label: string;
  departure_date: string | null;
  cutoff_date: string | null;
  group_id: string | null;
  invite_link: string | null;
  status: DepartureStatus;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';
}

export default function DeparturesPanel({
  groups,
  communityConfigured,
}: {
  groups: GroupRow[];
  communityConfigured: boolean;
}) {
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<DepartureKind>('air');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [cutoff, setCutoff] = useState('');
  const [groupMode, setGroupMode] = useState<'create' | 'existing' | 'later'>('create');
  const [phonesTxt, setPhonesTxt] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sendOpening, setSendOpening] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/playbook/departures');
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d.departures)) setDepartures(d.departures);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const suggestedLabel = useMemo(() => {
    const k = DEPARTURE_KIND_META[kind];
    const d = date
      ? new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      : '';
    return `${k.emoji} Départ ${k.label} · ${d || '[date]'}`;
  }, [kind, date]);

  const createDeparture = async () => {
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch('/api/playbook/departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          label: label.trim() || suggestedLabel,
          departure_date: date || null,
          cutoff_date: cutoff || null,
          create_group: groupMode === 'create',
          phones: groupMode === 'create' ? phonesTxt.split(/[\s,;\n]+/).filter(Boolean) : undefined,
          group_id: groupMode === 'existing' ? groupId : undefined,
          send_opening: groupMode !== 'later' && sendOpening,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${d.error}`);
        return;
      }
      setMsg(d.warning ? `⚠️ Départ créé — ${d.warning}` : '✅ Départ créé');
      setFormOpen(false);
      setLabel(''); setDate(''); setCutoff(''); setPhonesTxt(''); setGroupId('');
      load();
    } finally {
      setCreating(false);
    }
  };

  const sendMilestone = async (dep: Departure, milestone: DepartureStatus) => {
    const meta = MILESTONES.find((m) => m.key === milestone);
    const note = window.prompt(
      `${meta?.emoji} ${meta?.label} — « ${dep.label} »\n\nPrécision à ajouter au message (optionnel) :`,
      '',
    );
    if (note === null) return;
    setBusy(dep.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/playbook/departures/${dep.id}/milestone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone, note: note || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${d.error}`);
        return;
      }
      setDepartures((prev) => prev.map((x) => (x.id === dep.id ? { ...x, status: milestone } : x)));
      setMsg(`✅ ${meta?.label} envoyé dans « ${dep.label} »`);
    } finally {
      setBusy(null);
    }
  };

  const linkGroup = async (dep: Departure) => {
    const gid = window.prompt('Collez l’ID du groupe WhatsApp (…@g.us) :', dep.group_id || '');
    if (gid === null) return;
    const res = await fetch(`/api/playbook/departures/${dep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: gid }),
    });
    if (res.ok) load();
  };

  const removeDeparture = async (dep: Departure) => {
    if (!window.confirm(`Supprimer le départ « ${dep.label} » ? (le groupe WhatsApp n'est pas supprimé)`)) return;
    await fetch(`/api/playbook/departures/${dep.id}`, { method: 'DELETE' });
    setDepartures((prev) => prev.filter((x) => x.id !== dep.id));
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      window.prompt('Copiez :', text);
    }
  };

  const active = departures.filter((d) => d.status !== 'closed');
  const closed = departures.filter((d) => d.status === 'closed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {communityConfigured
            ? 'Les nouveaux groupes sont créés comme sous-groupes de la communauté Oh My Group.'
            : 'Liez la communauté (onglet Communauté) pour créer les départs dedans.'}
        </p>
        <button
          onClick={() => setFormOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {formOpen ? 'Fermer' : 'Nouveau départ'}
        </button>
      </div>

      {msg && <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{msg}</p>}

      {formOpen && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <label className="text-[10px] font-medium text-slate-500">Type
              <select value={kind} onChange={(e) => setKind(e.target.value as DepartureKind)} className={inputCls}>
                <option value="air">✈️ Aérien</option>
                <option value="sea">🚢 Maritime</option>
              </select>
            </label>
            <label className="text-[10px] font-medium text-slate-500 sm:col-span-2">Nom du groupe
              <input className={inputCls} placeholder={suggestedLabel} value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label className="text-[10px] font-medium text-slate-500">Date de départ
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-[10px] font-medium text-slate-500">Cut-off paiement
              <input className={inputCls} type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
            </label>
            <label className="text-[10px] font-medium text-slate-500 sm:col-span-3">Groupe WhatsApp
              <select value={groupMode} onChange={(e) => setGroupMode(e.target.value as typeof groupMode)} className={inputCls}>
                <option value="create">
                  {communityConfigured ? 'Créer le sous-groupe dans la communauté' : 'Créer le groupe (via WHAPI)'}
                </option>
                <option value="existing">Lier un groupe existant</option>
                <option value="later">Plus tard</option>
              </select>
            </label>
          </div>
          {groupMode === 'create' && (
            <label className="block text-[10px] font-medium text-slate-500">
              Numéros des premiers clients (le reste rejoindra par lien d’invitation)
              <textarea className={inputCls} rows={2} placeholder="24107xxxxxxx, 24106xxxxxxx" value={phonesTxt} onChange={(e) => setPhonesTxt(e.target.value)} />
            </label>
          )}
          {groupMode === 'existing' && (
            <label className="block text-[10px] font-medium text-slate-500">
              Groupe existant
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
                <option value="">— choisir —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.participantsCount})</option>
                ))}
              </select>
            </label>
          )}
          {groupMode !== 'later' && (
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={sendOpening} onChange={(e) => setSendOpening(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                Envoyer le message d’ouverture (à épingler ensuite dans WhatsApp)
              </label>
              {sendOpening && (
                <pre className="mt-2 max-w-xl whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {buildOpeningMessage({ kind, label: label.trim() || suggestedLabel, cutoff_date: cutoff || null, departure_date: date || null })}
                </pre>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={createDeparture}
              disabled={creating || (groupMode === 'create' && !phonesTxt.trim()) || (groupMode === 'existing' && !groupId)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Créer le départ
            </button>
          </div>
        </div>
      )}

      {active.length === 0 && !formOpen ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
          Aucun départ en cours. Créez le premier groupe à J-7 du cut-off.
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((dep) => {
            const Icon = dep.kind === 'air' ? Plane : Ship;
            const st = DEPARTURE_STATUS_META[dep.status];
            const currentIdx = MILESTONES.findIndex((m) => m.key === dep.status);
            return (
              <div key={dep.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${dep.kind === 'air' ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{dep.label}</p>
                    <p className="text-[11px] text-slate-400">
                      Cut-off : {fmtDate(dep.cutoff_date)} · Départ : {fmtDate(dep.departure_date)}
                      {!dep.group_id && ' · ⚠️ aucun groupe lié'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  {dep.invite_link && (
                    <button onClick={() => copyText(dep.invite_link!, dep.id)} title="Copier le lien d'invitation" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                      {copied === dep.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
                    </button>
                  )}
                  {!dep.group_id && (
                    <button onClick={() => linkGroup(dep)} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-600 hover:bg-amber-50">
                      Lier un groupe
                    </button>
                  )}
                  <button onClick={() => removeDeparture(dep)} title="Supprimer" className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {dep.group_id && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-700">
                    {MILESTONES.map((m, i) => {
                      const done = i <= currentIdx;
                      return (
                        <button
                          key={m.key}
                          onClick={() => sendMilestone(dep, m.key)}
                          disabled={busy === dep.id}
                          title={`Envoyer « ${m.label} » dans le groupe`}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${
                            done
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'border border-slate-200 text-slate-600 hover:border-emerald-300 dark:border-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {busy === dep.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{m.emoji}</span>}
                          {m.label}
                        </button>
                      );
                    })}
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                      <MessageCircle className="h-3 w-3" /> chaque bouton envoie le message dans le groupe
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-slate-400">
            {closed.length} départ(s) clôturé(s)
          </summary>
          <ul className="mt-2 space-y-1">
            {closed.map((dep) => (
              <li key={dep.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800">
                <span>{dep.label} — départ {fmtDate(dep.departure_date)}</span>
                <button onClick={() => removeDeparture(dep)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
