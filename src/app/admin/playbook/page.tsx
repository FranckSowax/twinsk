'use client';

// Playbook WhatsApp — pilotage opérationnel de la communauté Oh My Group :
// rituels de la semaine, récap catalogue du vendredi, groupes de départ
// logistique (création + jalons) et modèles de messages.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  Plane,
  Plus,
  RefreshCw,
  Send,
  Ship,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildOpeningMessage,
  buildRecapMessage,
  DEPARTURE_KIND_META,
  DEPARTURE_STATUS_META,
  MILESTONES,
  RITUALS,
  type DepartureKind,
  type DepartureStatus,
} from '@/lib/playbook';

interface Departure {
  id: string;
  kind: DepartureKind;
  label: string;
  departure_date: string | null;
  cutoff_date: string | null;
  group_id: string | null;
  invite_link: string | null;
  status: DepartureStatus;
  created_at: string;
}
interface OfferRow {
  id: string;
  title: string;
  status: string;
  offer_type?: string | null;
  archived_at?: string | null;
}
interface GroupRow {
  id: string;
  name: string;
  participantsCount: number;
}

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export default function AdminPlaybookPage() {
  // ---- Rituels ----
  const [lastDone, setLastDone] = useState<Record<string, { done_at: string }>>({});
  const [markingRitual, setMarkingRitual] = useState<string | null>(null);

  // ---- Récap ----
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeArchived, setIncludeArchived] = useState(false);
  const [recapText, setRecapText] = useState('');
  const [recapEdited, setRecapEdited] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [recapGroup, setRecapGroup] = useState('');
  const [recapSending, setRecapSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // ---- Départs ----
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [depFormOpen, setDepFormOpen] = useState(false);
  const [depKind, setDepKind] = useState<DepartureKind>('air');
  const [depLabel, setDepLabel] = useState('');
  const [depDate, setDepDate] = useState('');
  const [depCutoff, setDepCutoff] = useState('');
  const [depGroupMode, setDepGroupMode] = useState<'create' | 'existing' | 'later'>('create');
  const [depPhones, setDepPhones] = useState('');
  const [depGroupId, setDepGroupId] = useState('');
  const [depSendOpening, setDepSendOpening] = useState(true);
  const [depCreating, setDepCreating] = useState(false);
  const [busyDep, setBusyDep] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [logRes, offersRes, depRes, groupsRes] = await Promise.all([
      fetch('/api/playbook/log'),
      fetch('/api/offers'),
      fetch('/api/playbook/departures'),
      fetch('/api/whapi/groups'),
    ]);
    if (logRes.ok) {
      const d = await logRes.json();
      if (d.last) setLastDone(d.last);
    }
    if (offersRes.ok) {
      const d = await offersRes.json();
      if (Array.isArray(d)) setOffers(d);
    }
    if (depRes.ok) {
      const d = await depRes.json();
      if (Array.isArray(d.departures)) setDepartures(d.departures);
    }
    if (groupsRes.ok) {
      const d = await groupsRes.json();
      if (Array.isArray(d.groups)) setGroups(d.groups);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Rituels : jour courant + état "fait récemment" ----
  const todayIso = ((new Date().getDay() + 6) % 7) + 1; // 1 = lundi … 7 = dimanche
  const isDoneRecently = (key: string, day: number | 'monthly') => {
    const last = lastDone[key];
    if (!last) return false;
    const doneAt = new Date(last.done_at);
    const now = new Date();
    if (day === 'monthly') {
      return doneAt.getMonth() === now.getMonth() && doneAt.getFullYear() === now.getFullYear();
    }
    // Fait cette semaine (depuis lundi 00h) ?
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
      const res = await fetch('/api/playbook/log');
      if (res.ok) {
        const d = await res.json();
        if (d.last) setLastDone(d.last);
      }
    } finally {
      setMarkingRitual(null);
    }
  };

  // ---- Récap ----
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
      .map((o) => ({ title: o.title, url: `${typeof window !== 'undefined' ? window.location.origin : ''}/offer/${o.id}` }));
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

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      window.prompt('Copiez le texte :', text);
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
      setMsg(res.ok ? '✅ Récap envoyé dans le groupe — pensez à l’épingler 📌 (30 jours)' : `❌ ${d.error}`);
      if (res.ok) load();
    } finally {
      setRecapSending(false);
    }
  };

  // ---- Départs ----
  const suggestedLabel = useMemo(() => {
    const k = DEPARTURE_KIND_META[depKind];
    const d = depDate
      ? new Date(depDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      : '';
    return `${k.emoji} Départ ${k.label} · ${d || '[date]'}`;
  }, [depKind, depDate]);

  const createDeparture = async () => {
    const label = depLabel.trim() || suggestedLabel;
    setDepCreating(true);
    setMsg(null);
    try {
      const res = await fetch('/api/playbook/departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: depKind,
          label,
          departure_date: depDate || null,
          cutoff_date: depCutoff || null,
          create_group: depGroupMode === 'create',
          phones: depGroupMode === 'create' ? depPhones.split(/[\s,;\n]+/).filter(Boolean) : undefined,
          group_id: depGroupMode === 'existing' ? depGroupId : undefined,
          send_opening: depGroupMode !== 'later' && depSendOpening,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${d.error}`);
        return;
      }
      setMsg(d.warning ? `⚠️ Départ créé — ${d.warning}` : '✅ Départ créé');
      setDepFormOpen(false);
      setDepLabel(''); setDepDate(''); setDepCutoff(''); setDepPhones(''); setDepGroupId('');
      load();
    } finally {
      setDepCreating(false);
    }
  };

  const sendMilestone = async (dep: Departure, milestone: DepartureStatus) => {
    const meta = MILESTONES.find((m) => m.key === milestone);
    const note = window.prompt(
      `${meta?.emoji} ${meta?.label} — « ${dep.label} »\n\nPrécision à ajouter au message (optionnel) :`,
      '',
    );
    if (note === null) return; // annulé
    setBusyDep(dep.id);
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
      setBusyDep(null);
    }
  };

  const linkGroup = async (dep: Departure) => {
    const gid = window.prompt(
      'Collez l’ID du groupe WhatsApp (…@g.us) — visible dans l’onglet WhatsApp → Groupes :',
      dep.group_id || '',
    );
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

  const activeDeps = departures.filter((d) => d.status !== 'closed');
  const closedDeps = departures.filter((d) => d.status === 'closed');

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
          <BookOpenCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Playbook WhatsApp</h1>
          <p className="text-sm text-slate-500">Rituels, récap catalogue et groupes de départ — le pilotage d’Oh My Group.</p>
        </div>
        <button onClick={load} title="Rafraîchir" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {msg && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ============ 1. Rituels de la semaine ============ */}
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
                  title={done ? 'Déjà fait cette période — recliquer pour re-tracer' : 'Marquer fait'}
                  className={`rounded-lg p-1.5 ${done ? 'text-emerald-500' : 'text-slate-300 hover:bg-slate-100 hover:text-emerald-500 dark:hover:bg-slate-700'}`}
                >
                  {markingRitual === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ 2. Récap catalogue (vendredi) ============ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Récap catalogue — repost des liens</h2>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Inclure les listings archivés
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-slate-500">Sélectionnez les listings à inclure ({selected.size}/10 max) :</p>
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
                <option value="">Groupe par défaut</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.participantsCount})</option>
                ))}
              </select>
              <button
                onClick={() => copyText(recapText, 'recap')}
                disabled={!recapText.trim()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
              >
                {copied === 'recap' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'recap' ? 'Copié !' : 'Copier'}
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
            <p className="text-[11px] text-slate-400">Après envoi : épinglez le message dans WhatsApp (📌 2, durée 30 jours).</p>
          </div>
        </div>
      </section>

      {/* ============ 3. Groupes départs ============ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Groupes de départ (logistique)</h2>
          <button
            onClick={() => setDepFormOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" /> Nouveau départ
          </button>
        </div>

        {depFormOpen && (
          <div className="mb-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <label className="text-[10px] font-medium text-slate-500">Type
                <select value={depKind} onChange={(e) => setDepKind(e.target.value as DepartureKind)} className={inputCls}>
                  <option value="air">✈️ Aérien</option>
                  <option value="sea">🚢 Maritime</option>
                </select>
              </label>
              <label className="text-[10px] font-medium text-slate-500 sm:col-span-2">Nom du groupe
                <input className={inputCls} placeholder={suggestedLabel} value={depLabel} onChange={(e) => setDepLabel(e.target.value)} />
              </label>
              <label className="text-[10px] font-medium text-slate-500">Date de départ
                <input className={inputCls} type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} />
              </label>
              <label className="text-[10px] font-medium text-slate-500">Cut-off paiement
                <input className={inputCls} type="date" value={depCutoff} onChange={(e) => setDepCutoff(e.target.value)} />
              </label>
              <label className="text-[10px] font-medium text-slate-500 sm:col-span-3">Groupe WhatsApp
                <select value={depGroupMode} onChange={(e) => setDepGroupMode(e.target.value as typeof depGroupMode)} className={inputCls}>
                  <option value="create">Créer le groupe automatiquement (via WHAPI)</option>
                  <option value="existing">Lier un groupe existant</option>
                  <option value="later">Plus tard</option>
                </select>
              </label>
            </div>
            {depGroupMode === 'create' && (
              <label className="block text-[10px] font-medium text-slate-500">
                Numéros des premiers clients (format international, séparés par virgule ou retour ligne — le reste rejoindra par lien d’invitation)
                <textarea className={inputCls} rows={2} placeholder="24107xxxxxxx, 24106xxxxxxx" value={depPhones} onChange={(e) => setDepPhones(e.target.value)} />
              </label>
            )}
            {depGroupMode === 'existing' && (
              <label className="block text-[10px] font-medium text-slate-500">
                Groupe existant
                <select value={depGroupId} onChange={(e) => setDepGroupId(e.target.value)} className={inputCls}>
                  <option value="">— choisir —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.participantsCount})</option>
                  ))}
                </select>
              </label>
            )}
            {depGroupMode !== 'later' && (
              <div>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={depSendOpening} onChange={(e) => setDepSendOpening(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                  Envoyer le message d’ouverture (et l’épingler ensuite dans WhatsApp)
                </label>
                {depSendOpening && (
                  <pre className="mt-2 max-w-xl whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {buildOpeningMessage({ kind: depKind, label: depLabel.trim() || suggestedLabel, cutoff_date: depCutoff || null, departure_date: depDate || null })}
                  </pre>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDepFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-slate-600">Annuler</button>
              <button
                onClick={createDeparture}
                disabled={depCreating || (depGroupMode === 'create' && !depPhones.trim()) || (depGroupMode === 'existing' && !depGroupId)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {depCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Créer le départ
              </button>
            </div>
          </div>
        )}

        {activeDeps.length === 0 && !depFormOpen ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
            Aucun départ en cours. Créez le premier groupe à J-7 du cut-off.
          </div>
        ) : (
          <div className="space-y-3">
            {activeDeps.map((dep) => {
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
                            disabled={busyDep === dep.id}
                            title={`Envoyer « ${m.label} » dans le groupe`}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${
                              done
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'border border-slate-200 text-slate-600 hover:border-emerald-300 dark:border-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {busyDep === dep.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{m.emoji}</span>}
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

        {closedDeps.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-400">
              {closedDeps.length} départ(s) clôturé(s)
            </summary>
            <ul className="mt-2 space-y-1">
              {closedDeps.map((dep) => (
                <li key={dep.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800">
                  <span>{dep.label} — départ {fmtDate(dep.departure_date)}</span>
                  <button onClick={() => removeDeparture(dep)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
