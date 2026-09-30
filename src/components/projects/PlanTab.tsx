'use client';

// Plan d'action : étapes, tâches (responsable, échéance, statut, phase
// verrouillée), progression ; fenêtre de tâche avec checklist cochable,
// pièces jointes et fil de commentaires équipe ↔ client.

import { useState } from 'react';
import { CheckCircle2, Circle, Lock, MessageSquare, Paperclip, Plus, RotateCcw } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { Attachment } from '@/lib/projects/types';
import { AttachButton, AttachmentList, AuthorChip, Badge, Empty, Modal, Progress, btn, btnPrimary, card, dateShort, dateTime, input, label, type WorkspaceApi } from './shared';

type Task = PublicProject['tasks'][number];

export default function PlanTab({ p, api }: { p: PublicProject; api: WorkspaceApi }) {
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const task = p.tasks.find((t) => t.id === open) || null;
  const phaseName = (id: string | null) => p.phases.find((x) => x.id === id)?.name || null;
  const overdue = (t: Task) => t.status !== 'done' && new Date(t.due_at) < new Date();
  const canToggle = (t: Task) => !t.locked && (api.mode === 'client' ? t.owner === 'client' : t.owner === 'team');
  // Client : ses validations à faire, en tête du plan.
  const mine = api.mode === 'client' ? p.tasks.filter((t) => t.owner === 'client' && t.status !== 'done' && !t.locked) : [];

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Avancement global</p>
          <span className="font-display text-2xl font-bold tabular-nums text-emerald-600">{Math.round(p.progress.global * 100)} %</span>
        </div>
        <Progress value={p.progress.global} className="mt-2" />
        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
          {p.phases.map((ph) => (
            <span key={ph.id} className={`flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold sm:rounded-full sm:py-1 ${ph.received ? 'bg-emerald-100 text-emerald-800' : ph.locked ? 'bg-slate-100 text-slate-500' : 'bg-sky-100 text-sky-800'}`}>
              {ph.locked && <Lock className="h-3 w-3" />}
              {ph.name}{ph.sites.length && !ph.sites.every((x) => ph.name.includes(x)) ? ` · ${ph.sites.join(', ')}` : ''}
              {ph.received ? ' · réceptionnée' : ph.locked ? ' · verrouillée' : ' · en cours'}
              {api.mode === 'team' && (
                <button type="button" onClick={() => api.act('phase.receive', { phase_id: ph.id, received: !ph.received })} className="ml-1 underline decoration-dotted" title={ph.received ? 'Rouvrir la phase' : 'Marquer la phase réceptionnée'}>
                  {ph.received ? 'rouvrir' : 'réceptionner'}
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {mine.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3.5 dark:border-sky-900 dark:bg-sky-950/30 sm:p-4">
          <p className="text-sm font-bold text-sky-900 dark:text-sky-100">À vous de jouer · {mine.length} validation{mine.length > 1 ? 's' : ''}</p>
          <ul className="mt-2 space-y-1.5">
            {mine.slice(0, 5).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setOpen(t.id)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm shadow-sm dark:bg-slate-900">
                  <span className="min-w-0 font-medium text-slate-900 dark:text-white">{t.title}</span>
                  <span className={`shrink-0 text-[11px] ${overdue(t) ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{dateShort(t.due_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.steps.map((s) => {
        const tasks = p.tasks.filter((t) => t.step_key === s.key);
        const pct = p.progress.bySteps[s.key] || 0;
        return (
          <div key={s.key} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-slate-900 dark:text-white">{s.title}</p>
                <p className="text-xs text-slate-500">{s.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-slate-600">{tasks.filter((t) => t.status === 'done').length}/{tasks.length}</span>
                {api.mode === 'team' && <button type="button" onClick={() => setCreating(s.key)} className={btn}><Plus className="h-3.5 w-3.5" /> Tâche</button>}
              </div>
            </div>
            <Progress value={pct} className="mt-2" />
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
              {tasks.map((t) => (
                <li key={t.id} className={`flex items-start gap-1 py-1.5 sm:gap-3 sm:py-2.5 ${t.locked ? 'opacity-55' : ''}`}>
                  {/* Case large au pouce ; seule la personne responsable peut la cocher */}
                  <button type="button" onClick={() => api.act('task.done', { task_id: t.id, done: t.status !== 'done' })} disabled={!canToggle(t)} className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-emerald-600 disabled:cursor-not-allowed sm:ml-0 sm:mt-0.5 sm:h-auto sm:w-auto" title={t.status === 'done' ? 'Rouvrir' : 'Marquer terminée'} aria-label={t.status === 'done' ? `Rouvrir : ${t.title}` : `Marquer terminée : ${t.title}`}>
                    {t.status === 'done' ? <CheckCircle2 className="h-6 w-6 sm:h-5 sm:w-5" /> : <Circle className={`h-6 w-6 sm:h-5 sm:w-5 ${canToggle(t) ? 'text-slate-300' : 'text-slate-200 dark:text-slate-700'}`} />}
                  </button>
                  <button type="button" onClick={() => setOpen(t.id)} className="min-w-0 flex-1 py-2 text-left sm:py-0">
                    <p className={`text-sm font-medium ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{t.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <Badge tone={t.owner === 'client' ? 'blue' : 'slate'}>{t.owner === 'client' ? 'Client' : 'Équipe'}</Badge>
                      <span className={overdue(t) ? 'font-semibold text-red-600' : ''}>{dateShort(t.due_at)}</span>
                      {t.phase && <span>· {phaseName(t.phase)}</span>}
                      {t.locked && <Lock className="h-3 w-3" />}
                      {t.checklist.length > 0 && <span>· {t.checklist.filter((c) => c.done).length}/{t.checklist.length} points</span>}
                      {t.comments.length > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {t.comments.length}</span>}
                      {t.attachments.length > 0 && <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" /> {t.attachments.length}</span>}
                    </p>
                  </button>
                </li>
              ))}
              {tasks.length === 0 && <Empty>Aucune tâche.</Empty>}
            </ul>
          </div>
        );
      })}

      {task && <TaskModal t={task} p={p} api={api} onClose={() => setOpen(null)} />}
      {creating && api.mode === 'team' && <NewTaskModal stepKey={creating} p={p} api={api} onClose={() => setCreating(null)} />}
    </div>
  );
}

function TaskModal({ t, p, api, onClose }: { t: Task; p: PublicProject; api: WorkspaceApi; onClose: () => void }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (action: string, payload: Record<string, unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await api.act(action, payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };
  const canToggle = !t.locked && (api.mode === 'client' ? t.owner === 'client' : t.owner === 'team');
  return (
    <Modal title={t.title} onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          {t.description && <p className="text-sm text-slate-700 dark:text-slate-200">{t.description}</p>}
          {t.checklist.length > 0 && (
            <div>
              <p className={label}>Checklist</p>
              <ul className="space-y-1.5">
                {t.checklist.map((c) => (
                  <li key={c.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 text-sm active:bg-slate-50 sm:min-h-0 sm:gap-2 sm:px-0">
                      <input type="checkbox" checked={c.done} disabled={busy || t.locked} onChange={(e) => run('task.checklist', { task_id: t.id, item_id: c.id, done: e.target.checked })} className="h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 sm:h-4 sm:w-4" />
                      <span className={c.done ? 'text-slate-400 line-through' : ''}>{c.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className={label}>Pièces jointes</p>
            <AttachmentList items={t.attachments} />
            <div className="mt-2">
              <AttachButton api={api} label="Joindre à la tâche" onAttached={(a) => run('task.attach', { task_id: t.id, attachments: a })} />
            </div>
          </div>
          <div>
            <p className={label}>Commentaires</p>
            <ul className="space-y-2">
              {t.comments.map((c) => (
                <li key={c.id} className={`rounded-xl px-3 py-2 text-sm ${c.author === 'client' ? 'bg-sky-50 dark:bg-sky-950/30' : 'bg-slate-50 dark:bg-slate-800'}`}>
                  <p className="mb-1 flex items-center gap-2 text-[11px] text-slate-500"><AuthorChip author={c.author} name={c.author_name} /> {dateTime(c.at)}</p>
                  <p className="whitespace-pre-wrap">{c.text}</p>
                  <AttachmentList items={c.attachments} />
                </li>
              ))}
              {t.comments.length === 0 && <li className="text-xs text-slate-500">Aucun commentaire.</li>}
            </ul>
            <div className="mt-2 space-y-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Écrire un commentaire…" className={input} />
              <AttachmentList items={files} onRemove={(i) => setFiles((f) => f.filter((_, k) => k !== i))} />
              <div className="flex flex-wrap gap-2">
                <AttachButton api={api} onAttached={(a) => setFiles((f) => [...f, ...a])} />
                <button type="button" disabled={busy || (!text.trim() && !files.length)} onClick={async () => { await run('task.comment', { task_id: t.id, text, attachments: files }); setText(''); setFiles([]); }} className={btnPrimary}>Envoyer</button>
              </div>
            </div>
          </div>
        </div>
        <aside className="order-first space-y-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800 md:order-none">
          <p><span className="text-slate-500">Responsable :</span> {t.owner === 'client' ? 'Client' : 'Équipe'}</p>
          <p><span className="text-slate-500">Échéance :</span> {dateShort(t.due_at)}</p>
          {t.phase && <p><span className="text-slate-500">Phase :</span> {p.phases.find((x) => x.id === t.phase)?.name}</p>}
          <p><span className="text-slate-500">Statut :</span> {t.status === 'done' ? <Badge tone="emerald">Terminée</Badge> : t.locked ? <Badge>Verrouillée</Badge> : <Badge tone="amber">À faire</Badge>}</p>
          {canToggle && (
            <button type="button" disabled={busy} onClick={() => run('task.done', { task_id: t.id, done: t.status !== 'done' })} className={`${t.status === 'done' ? btn : btnPrimary} w-full md:w-auto`}>
              {t.status === 'done' ? <><RotateCcw className="h-3.5 w-3.5" /> Rouvrir</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Marquer terminée</>}
            </button>
          )}
          {!canToggle && !t.locked && <p className="text-[11px] text-slate-500">{t.owner === 'client' ? 'Cette validation revient au client.' : 'Tâche à la charge de l’équipe.'}</p>}
          {t.locked && <p className="text-[11px] text-slate-500">Phase verrouillée tant que la phase précédente n’est pas réceptionnée.</p>}
          {err && <p className="text-xs text-red-600">{err}</p>}
        </aside>
      </div>
    </Modal>
  );
}

function NewTaskModal({ stepKey, p, api, onClose }: { stepKey: string; p: PublicProject; api: WorkspaceApi; onClose: () => void }) {
  const [f, setF] = useState({ title: '', description: '', owner: 'team', due_at: '', phase: '', checklist: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title="Nouvelle tâche" onClose={onClose}>
      <div className="space-y-3">
        <div><label className={label}>Titre</label><input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className={label}>Description</label><textarea className={input} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={label}>Responsable</label><select className={input} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}><option value="team">Équipe</option><option value="client">Client</option></select></div>
          <div><label className={label}>Échéance</label><input type="date" className={input} value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></div>
          <div><label className={label}>Phase</label><select className={input} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })}><option value="">Commune</option>{p.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}</select></div>
        </div>
        <div><label className={label}>Checklist (une ligne par point)</label><textarea className={input} rows={3} value={f.checklist} onChange={(e) => setF({ ...f, checklist: e.target.value })} /></div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button type="button" disabled={busy || !f.title.trim()} onClick={async () => { setBusy(true); setErr(''); try { await api.act('task.create', { step_key: stepKey, title: f.title, description: f.description, owner: f.owner, due_at: f.due_at ? new Date(f.due_at).toISOString() : null, phase: f.phase || null, checklist: f.checklist.split('\n').map((x) => x.trim()).filter(Boolean) }); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={btnPrimary}>Créer</button>
      </div>
    </Modal>
  );
}
