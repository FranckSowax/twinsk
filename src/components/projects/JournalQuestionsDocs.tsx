'use client';

// Journal (mises à jour, commentaires), Questions (tickets, délai 24 h ouvrées),
// Documents (bibliothèque par catégorie) — partagés équipe / client.

import { useState } from 'react';
import { FileText, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import { DOCUMENT_CATEGORIES, type Attachment } from '@/lib/projects/types';
import { AttachButton, AttachmentList, AuthorChip, Badge, Empty, btn, btnPrimary, card, dateTime, input, label, size, type WorkspaceApi } from './shared';

export function JournalTab({ p, api }: { p: PublicProject; api: WorkspaceApi }) {
  const [f, setF] = useState({ title: '', body: '' });
  const [files, setFiles] = useState<Attachment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState('');
  // Brouillon depuis ce qui a bougé (tâches, commandes, questions, documents, échanges) : à relire, rien n'est publié.
  const prepare = async () => {
    setAiBusy(true);
    setErr('');
    try {
      const r = await api.ai('update.draft', {});
      const d = r.draft as { title: string; body: string };
      setF({ title: d.title, body: d.body });
      const u = r.usage as { model: string; costFcfa: number };
      setAiInfo(`Brouillon proposé (${u.model} · ${u.costFcfa} FCFA) — relisez avant de publier.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Brouillon impossible');
    } finally {
      setAiBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {api.mode === 'team' && (
        <div className={card}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Publier la mise à jour du jour</p>
            <button type="button" disabled={aiBusy} onClick={prepare} className={btn} title="Rédige un brouillon à partir de ce qui a bougé depuis la dernière mise à jour">{aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Préparer avec l’IA</button>
          </div>
          {aiInfo && <p className="mb-2 text-[11px] text-emerald-700">{aiInfo}</p>}
          <div className="space-y-2">
            <input className={input} placeholder="Titre (ex. Réception des échantillons de gazon)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <textarea className={input} rows={3} placeholder="Ce qui s’est passé, ce qui vient…" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
            <AttachmentList items={files} onRemove={(i) => setFiles((x) => x.filter((_, k) => k !== i))} />
            <div className="flex flex-wrap gap-2">
              <AttachButton api={api} category="reports" onAttached={(a) => setFiles((x) => [...x, ...a])} />
              <button type="button" disabled={busy || !f.title.trim()} onClick={async () => { setBusy(true); setErr(''); try { await api.act('update.publish', { ...f, attachments: files }); setF({ title: '', body: '' }); setFiles([]); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={btnPrimary}><Send className="h-3.5 w-3.5" /> Publier</button>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>
        </div>
      )}
      {p.updates.length === 0 && <Empty>Aucune mise à jour pour l’instant.</Empty>}
      {p.updates.map((u) => (
        <article key={u.id} className={card}>
          <p className="text-[11px] text-slate-500">{dateTime(u.at)}</p>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{u.title}</h3>
          {u.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{u.body}</p>}
          <AttachmentList items={u.attachments} />
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            {u.comments.map((c) => (
              <p key={c.id} className="text-sm"><AuthorChip author={c.author} name={c.author_name} /> <span className="text-[11px] text-slate-400">{dateTime(c.at)}</span><br />{c.text}</p>
            ))}
            <div className="flex gap-2">
              <input className={input} placeholder="Réagir…" value={drafts[u.id] || ''} onChange={(e) => setDrafts({ ...drafts, [u.id]: e.target.value })} />
              <button type="button" disabled={!(drafts[u.id] || '').trim()} onClick={async () => { await api.act('update.comment', { update_id: u.id, text: drafts[u.id] }); setDrafts({ ...drafts, [u.id]: '' }); }} className={btn}><Send className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function QuestionsTab({ p, api }: { p: PublicProject; api: WorkspaceApi }) {
  const [f, setF] = useState({ subject: '', detail: '' });
  const [file, setFile] = useState<Attachment | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const open = p.questions.filter((q) => q.status === 'open');
  return (
    <div className="space-y-4">
      {api.mode === 'client' && (
        <div className={card}>
          <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Poser une question</p>
          <p className="mb-2 text-xs text-slate-500">Réponse sous 24 h ouvrées.</p>
          <div className="space-y-2">
            <input className={input} placeholder="Objet" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
            <textarea className={input} rows={3} placeholder="Détail de votre demande" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
            {file && <AttachmentList items={[file]} onRemove={() => setFile(null)} />}
            <div className="flex flex-wrap gap-2">
              {!file && <AttachButton api={api} label="Pièce jointe (facultatif)" onAttached={(a) => setFile(a[0] || null)} />}
              <button type="button" disabled={busy || !f.subject.trim()} onClick={async () => { setBusy(true); setErr(''); try { await api.act('question.ask', { ...f, attachment: file }); setF({ subject: '', detail: '' }); setFile(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={btnPrimary}><Send className="h-3.5 w-3.5" /> Envoyer</button>
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>
        </div>
      )}
      {api.mode === 'team' && open.length > 0 && <p className="text-sm font-semibold text-amber-700">{open.length} question(s) en attente de réponse.</p>}
      {p.questions.length === 0 && <Empty>Aucune question.</Empty>}
      {p.questions.map((q) => (
        <article key={q.id} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{q.subject}</h3>
            {q.status === 'open' ? <Badge tone="amber">En attente · réponse sous 24 h ouvrées</Badge> : <Badge tone="emerald">Répondu</Badge>}
          </div>
          <p className="text-[11px] text-slate-500">{dateTime(q.at)}</p>
          {q.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{q.detail}</p>}
          {q.attachment && <AttachmentList items={[q.attachment]} />}
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            {q.replies.map((r) => (
              <p key={r.id} className="text-sm"><AuthorChip author={r.author} name={r.author_name} /> <span className="text-[11px] text-slate-400">{dateTime(r.at)}</span><br /><span className="whitespace-pre-wrap">{r.text}</span></p>
            ))}
            <div className="flex gap-2">
              <input className={input} placeholder={api.mode === 'team' ? 'Répondre…' : 'Préciser…'} value={drafts[q.id] || ''} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} />
              <button type="button" disabled={!(drafts[q.id] || '').trim()} onClick={async () => { await api.act('question.reply', { question_id: q.id, text: drafts[q.id] }); setDrafts({ ...drafts, [q.id]: '' }); }} className={btnPrimary}><Send className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DocumentsTab({ p, api, internalIds = [] }: { p: PublicProject; api: WorkspaceApi; internalIds?: string[] }) {
  const [cat, setCat] = useState<string>('site');
  const [internal, setInternal] = useState(false);
  const [msg, setMsg] = useState('');
  const internalSet = new Set(internalIds);
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={label}>Catégorie</label>
            <select className={input} value={cat} onChange={(e) => setCat(e.target.value)}>{DOCUMENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </div>
          {api.mode === 'team' && (
            <label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Réservé à l’équipe (invisible du client)</label>
          )}
          <AttachButton api={api} category={cat} internal={internal} label="Déposer des fichiers" onAttached={(a) => setMsg(`${a.length} fichier(s) déposé(s).`)} />
        </div>
        {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
      </div>
      {DOCUMENT_CATEGORIES.map((c) => {
        const docs = p.documents.filter((d) => d.category === c.value);
        if (!docs.length) return null;
        return (
          <div key={c.value} className={card}>
            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{c.label}</p>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <a href={d.download_path} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline dark:text-white">{d.name}</a>
                  {internalSet.has(d.id) && <Badge>Équipe</Badge>}
                  <span className="text-[11px] text-slate-500">{size(d.size)} · {d.by} · {dateTime(d.at)}</span>
                  {api.mode === 'team' && (
                    <button type="button" onClick={() => { if (confirm(`Supprimer « ${d.name} » ?`)) api.act('document.delete', { document_id: d.id }); }} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {p.documents.length === 0 && <Empty>Aucun document.</Empty>}
    </div>
  );
}
