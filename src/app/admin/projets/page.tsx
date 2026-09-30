'use client';

// Liste des projets (suivi client) et création depuis un modèle.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Loader2, Plus, Sparkles } from 'lucide-react';
import { Badge, Modal, Progress, btnPrimary, card, dateShort, input, label } from '@/components/projects/shared';

interface Row { id: string; title: string; client_name: string | null; client_company: string | null; currency: string; status: string; started_at: string; tasks_total: number; tasks_done: number; open_questions: number; pending_team: number; updated_at: string }
interface Template { key: string; title: string; description: string; currency: string }

export default function ProjectsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch('/api/projects', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error || 'Chargement impossible');
      return;
    }
    setRows(d.projects || []);
    setTemplates(d.templates || []);
  }, []);
  useEffect(() => {
    // Différé : la règle react-hooks refuse un setState synchrone dans l'effet.
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-slate-900 dark:text-white"><FolderKanban className="h-7 w-7 text-emerald-500" /> Projets</h1>
          <p className="mt-1 text-sm text-slate-500">Programmes d’équipement suivis avec le client : plan d’action, journal, devis validé ligne par ligne, commandes.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className={btnPrimary}><Plus className="h-4 w-4" /> Nouveau projet</button>
      </div>
      {error && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
      {!rows && !error && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>}
      {rows && rows.length === 0 && <p className={`${card} text-center text-sm text-slate-500`}>Aucun projet. Créez le premier depuis le modèle « Programme DOM-TOM ».</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows?.map((p) => (
          <Link key={p.id} href={`/admin/projets/${p.id}`} className={`${card} block transition hover:border-emerald-300`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-slate-900 dark:text-white">{p.title}</p>
                <p className="text-xs text-slate-500">{[p.client_company, p.client_name].filter(Boolean).join(' · ') || 'Client à renseigner'} · lancé le {dateShort(p.started_at)}</p>
              </div>
              {p.status === 'closed' ? <Badge>Clôturé</Badge> : <Badge tone="emerald">En cours</Badge>}
            </div>
            <Progress value={p.tasks_total ? p.tasks_done / p.tasks_total : 0} className="mt-3" />
            <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>{p.tasks_done}/{p.tasks_total} tâches</span>
              {p.open_questions > 0 && <span className="font-semibold text-amber-700">{p.open_questions} question(s) en attente</span>}
              {p.pending_team > 0 && <span className="font-semibold text-emerald-700">{p.pending_team} nouveauté(s) client</span>}
            </p>
          </Link>
        ))}
      </div>
      {creating && <NewProjectModal templates={templates} onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}

interface Generated { title: string; description: string; phases: { name: string; sites: string[] }[]; steps: { title: string; tasks: { title: string }[] }[]; quote_lines: { label: string }[]; lots: string[] }

function NewProjectModal({ templates, onClose, onCreated }: { templates: Template[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [f, setF] = useState({ template_key: templates[0]?.key || 'dom-tom', title: '', client_name: '', client_company: '', client_phone: '', client_email: '', started_at: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Source du plan : un modèle prêt, ou un brief libre analysé par l'IA (Kimi via OpenRouter).
  const [source, setSource] = useState<'template' | 'brief'>('template');
  const [brief, setBrief] = useState('');
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genInfo, setGenInfo] = useState('');
  const t = templates.find((x) => x.key === f.template_key);
  const generate = async () => {
    setGenBusy(true);
    setErr('');
    setGenerated(null);
    try {
      const r = await fetch('/api/projects/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'plan', brief, currency: 'EUR' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Génération impossible');
      setGenerated(d.template);
      setGenInfo(`${d.usage.model} · ${d.usage.costFcfa} FCFA`);
      if (!f.title) setF((x) => ({ ...x, title: d.template.title }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setGenBusy(false);
    }
  };
  return (
    <Modal title="Nouveau projet" onClose={onClose} wide>
      <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60">
        {(['template', 'brief'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setSource(k)} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${source === k ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}>{k === 'template' ? 'Depuis un modèle' : '✨ Depuis un brief (IA)'}</button>
        ))}
      </div>
      {source === 'brief' && (
        <div className="mb-3 space-y-2">
          <label className={label}>Brief du projet (sites, équipements, quantités estimées, contraintes, calendrier)</label>
          <textarea className={input} rows={7} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Ex. Ouvrir 3 boulangeries à Libreville et Port-Gentil : fours, pétrins, chambres de pousse, vitrines réfrigérées, mobilier de salle, enseignes. Phase 1 : Libreville (2 sites) en mars ; phase 2 : Port-Gentil…" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={genBusy || brief.trim().length < 40} onClick={generate} className={btnPrimary}>{genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer le plan</button>
            {genInfo && <span className="text-[11px] text-slate-500">{genInfo}</span>}
          </div>
          {generated && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="font-semibold">{generated.title}</p>
              <p className="mt-1">{generated.description}</p>
              <p className="mt-2">{generated.phases.length} phase(s) : {generated.phases.map((p) => `${p.name}${p.sites.length ? ` (${p.sites.join(', ')})` : ''}`).join(' · ')}</p>
              <ul className="mt-2 space-y-0.5">{generated.steps.map((s, i) => <li key={i}>• {s.title} — {s.tasks.length} tâche(s)</li>)}</ul>
              <p className="mt-2">{generated.quote_lines.length} ligne(s) de devis à chiffrer, lots : {generated.lots.join(', ')}</p>
              <p className="mt-2 text-emerald-700">Relisez : tout reste modifiable après création (tâches, échéances, lignes).</p>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {source === 'template' && <div className="sm:col-span-2"><label className={label}>Modèle</label><select className={input} value={f.template_key} onChange={(e) => setF({ ...f, template_key: e.target.value })}>{templates.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}</select>{t && <p className="mt-1 text-xs text-slate-500">{t.description}</p>}</div>}
        <div className="sm:col-span-2"><label className={label}>Titre du projet</label><input className={input} placeholder={t?.title} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className={label}>Entreprise cliente</label><input className={input} value={f.client_company} onChange={(e) => setF({ ...f, client_company: e.target.value })} /></div>
        <div><label className={label}>Contact client</label><input className={input} value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} /></div>
        <div><label className={label}>WhatsApp du client (notifications)</label><input className={input} placeholder="+596…" value={f.client_phone} onChange={(e) => setF({ ...f, client_phone: e.target.value })} /></div>
        <div><label className={label}>E-mail</label><input className={input} value={f.client_email} onChange={(e) => setF({ ...f, client_email: e.target.value })} /></div>
        <div><label className={label}>Date de lancement (échéances calculées depuis)</label><input type="date" className={input} value={f.started_at} onChange={(e) => setF({ ...f, started_at: e.target.value })} /></div>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button type="button" disabled={busy || (source === 'brief' && !generated)} onClick={async () => { setBusy(true); setErr(''); try { const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, started_at: new Date(f.started_at).toISOString(), ...(source === 'brief' ? { generated, currency: 'EUR' } : {}) }) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Création impossible'); await onCreated(); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={`${btnPrimary} mt-4`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {source === 'brief' ? 'Créer ce projet' : 'Créer depuis le modèle'}</button>
    </Modal>
  );
}
