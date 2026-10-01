'use client';

// Journal (mises à jour, commentaires), Questions (tickets, délai 24 h ouvrées),
// Documents (bibliothèque par catégorie) — partagés équipe / client.

import { useState } from 'react';
import { Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { DOCUMENT_CATEGORIES, type Attachment } from '@/lib/projects/types';
import { AttachButton, AttachmentList, AuthorChip, Badge, Empty, FileActions, btn, btnPrimary, card, dateTime, downloadHref, fileKind, input, label, size, type WorkspaceApi } from './shared';

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
              <button type="button" disabled={!(drafts[u.id] || '').trim()} onClick={async () => { await api.act('update.comment', { update_id: u.id, text: drafts[u.id] }); setDrafts({ ...drafts, [u.id]: '' }); }} className={`${btn} shrink-0`} aria-label="Envoyer"><Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" /></button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function QuestionsTab({ p, api, admin }: { p: PublicProject; api: WorkspaceApi; admin?: TeamExtras }) {
  const [f, setF] = useState({ subject: '', detail: '', lot: '' });
  const [file, setFile] = useState<Attachment | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const team = api.mode === 'team';
  // Questions qui attendent une réponse de la personne qui regarde : client → celles de l'équipe ; équipe → celles du client.
  const waitingMe = p.questions.filter((q) => q.status === 'open' && (team ? q.direction === 'from_client' : q.direction === 'to_client'));
  const toClient = p.questions.filter((q) => q.direction === 'to_client');
  const fromClient = p.questions.filter((q) => q.direction !== 'to_client');
  const lots = [...new Set(p.quote.lines.map((l) => l.lot))];
  const supplierOf = (qid: string) => {
    const link = admin?.question_links?.[qid];
    return link?.supplier_id ? admin?.suppliers.find((s) => s.id === link.supplier_id) || null : null;
  };
  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      if (team) await api.act('question.to_client', { questions: [{ subject: f.subject, detail: f.detail }], lot: f.lot });
      else await api.act('question.ask', { subject: f.subject, detail: f.detail, attachment: file });
      setF({ subject: '', detail: '', lot: '' });
      setFile(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  const card_ = (q: PublicProject['questions'][number]) => {
    const ask = q.direction === 'to_client';
    const s = team ? supplierOf(q.id) : null;
    return (
      <article key={q.id} className={`${card} ${ask && !team && q.status === 'open' ? 'border-sky-300 dark:border-sky-800' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{q.subject}</h3>
          {ask
            ? q.status === 'open' ? <Badge tone="blue">{team ? 'En attente du client' : 'Votre réponse est attendue'}</Badge> : <Badge tone="emerald">Répondu</Badge>
            : q.status === 'open' ? <Badge tone="amber">{team ? 'À répondre' : 'En attente · réponse sous 24 h ouvrées'}</Badge> : <Badge tone="emerald">Répondu</Badge>}
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {ask ? <span className="font-semibold text-sky-700 dark:text-sky-300">Question de l’équipe</span> : <span>Question du client</span>}
          {q.lot && <span>· lot {q.lot}</span>}
          <span>· {dateTime(q.at)}</span>
          {s && <span className="text-violet-700 dark:text-violet-300">· venue de {s.real_name || s.alias} ({s.alias}) — interne</span>}
        </p>
        {q.detail && q.detail !== q.subject && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{q.detail}</p>}
        {q.attachment && <AttachmentList items={[q.attachment]} />}
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          {q.replies.map((r) => (
            <p key={r.id} className="text-sm"><AuthorChip author={r.author} name={r.author_name} /> <span className="text-[11px] text-slate-400">{dateTime(r.at)}</span><br /><span className="whitespace-pre-wrap">{r.text}</span></p>
          ))}
          <div className="flex gap-2">
            {ask && !team ? (
              <textarea className={input} rows={2} placeholder="Votre réponse…" value={drafts[q.id] || ''} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} />
            ) : (
              <input className={input} placeholder={team ? (ask ? 'Préciser la question…' : 'Répondre…') : 'Préciser…'} value={drafts[q.id] || ''} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} />
            )}
            <button type="button" disabled={!(drafts[q.id] || '').trim()} onClick={async () => { await api.act('question.reply', { question_id: q.id, text: drafts[q.id] }); setDrafts({ ...drafts, [q.id]: '' }); }} className={`${btnPrimary} shrink-0 self-end`} aria-label="Envoyer"><Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" /></button>
          </div>
        </div>
      </article>
    );
  };
  const form = (
      <div className={card}>
        <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{team ? 'Poser une question au client' : 'Poser une question'}</p>
        <p className="mb-2 text-xs text-slate-500">{team ? 'Le client est prévenu et répond dans son espace. Ne jamais nommer une usine.' : 'Réponse sous 24 h ouvrées.'}</p>
        <div className="space-y-2">
          <input className={input} placeholder={team ? 'Question (ex. Quelle couleur pour les lignes de jeu ?)' : 'Objet'} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          <textarea className={input} rows={3} placeholder={team ? 'Précisions ou contexte (facultatif)' : 'Détail de votre demande'} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
          {team && lots.length > 0 && <select className={`${input} sm:max-w-xs`} value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })}><option value="">Lot concerné (facultatif)</option>{lots.map((l) => <option key={l} value={l}>{l}</option>)}</select>}
          {!team && file && <AttachmentList items={[file]} onRemove={() => setFile(null)} />}
          <div className="flex flex-wrap gap-2">
            {!team && !file && <AttachButton api={api} label="Pièce jointe (facultatif)" onAttached={(a) => setFile(a[0] || null)} />}
            <button type="button" disabled={busy || !f.subject.trim()} onClick={submit} className={`${btnPrimary} flex-1 sm:flex-none`}><Send className="h-3.5 w-3.5" /> {team ? 'Envoyer au client' : 'Envoyer'}</button>
          </div>
          {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
        </div>
      </div>
  );
  // Client avec des questions de l'équipe en attente : elles passent avant le formulaire.
  const clientFirst = !team && waitingMe.length > 0;
  return (
    <div className="space-y-4">
      {!clientFirst && form}
      {waitingMe.length > 0 && <p className="text-sm font-semibold text-amber-700">{team ? `${waitingMe.length} question(s) du client en attente de réponse.` : `L’équipe a besoin de vos réponses : ${waitingMe.length} question(s).`}</p>}
      {p.questions.length === 0 && <Empty>Aucune question.</Empty>}
      {/* Client : questions de l'équipe d'abord (ouvertes en tête) ; équipe : questions du client d'abord. */}
      {(team ? [fromClient, toClient] : [toClient, fromClient]).map((list, i) =>
        list.length ? (
          <section key={i} className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{team ? (i === 0 ? 'Questions du client' : 'Questions posées au client') : i === 0 ? 'Questions de l’équipe' : 'Vos questions'}</p>
            {[...list].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open')).map(card_)}
          </section>
        ) : null,
      )}
      {clientFirst && form}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="sm:w-auto">
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
                  {(() => { const K = fileKind(d.name); return <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"><K.icon className="h-4 w-4" /><span className="text-[8px] font-bold uppercase leading-none">{K.label}</span></span>; })()}
                  {/* Le nom ouvre le fichier dans un nouvel onglet (PDF, images) ; les autres formats se téléchargent. */}
                  <a href={fileKind(d.name).viewable ? d.download_path : downloadHref(d.download_path)} target={fileKind(d.name).viewable ? '_blank' : undefined} rel="noopener noreferrer" className="flex min-h-11 min-w-0 flex-1 flex-col justify-center sm:min-h-0 sm:flex-row sm:items-center sm:justify-start sm:gap-3">
                    <span className="truncate font-medium text-slate-900 hover:underline dark:text-white">{d.name}</span>
                    <span className="text-[11px] text-slate-500 sm:ml-auto sm:shrink-0">{size(d.size)} · {d.by} · {dateTime(d.at)}</span>
                  </a>
                  {internalSet.has(d.id) && <Badge>Équipe</Badge>}
                  <FileActions url={d.download_path} name={d.name} />
                  {api.mode === 'team' && (
                    <button type="button" onClick={() => { if (confirm(`Supprimer « ${d.name} » ?`)) api.act('document.delete', { document_id: d.id }); }} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 sm:h-auto sm:w-auto sm:p-1" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
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
