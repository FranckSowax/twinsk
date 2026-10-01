'use client';

// Onglet « Échanges » de la fiche usine : le fil complet avec CETTE usine —
// messages envoyés (e-mails de la plateforme, envois notés à la main),
// réponses reçues avec leur analyse (réponse proposée EN/FR, explication,
// questions pour le client), notes internes — et l'ajout d'une réponse reçue
// (texte collé ou captures) analysée sur place.

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, Mail, NotebookPen, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { TeamExtras } from '@/lib/projects/public-server';
import type { ExchangeAnalysis } from '@/lib/projects/ai';
import { EXCHANGE_CHANNELS, type Attachment } from '@/lib/projects/types';
import { ContactHistory, contactsOf } from './ContactTrace';
import { EmailCompose } from './EmailCompose';
import { ExchangeAnalysisPanel } from './ExchangeAnalysis';
import { AttachButton, AttachmentList, Badge, Empty, btn, btnPrimary, dateShort, dateTime, input, label, type WorkspaceApi } from './shared';

type Supplier = TeamExtras['suppliers'][number];
type Exchange = TeamExtras['exchanges'][number];
type Direction = 'out' | 'in' | 'note';

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'in', label: 'Réponse reçue de l’usine' },
  { value: 'out', label: 'Message envoyé à l’usine' },
  { value: 'note', label: 'Note interne (appel, visite…)' },
];
const isAnalysis = (a: unknown): a is ExchangeAnalysis => !!a && typeof (a as { reply_en?: unknown }).reply_en === 'string';
/** Relance en retard : dernier échange de l'usine avec une échéance passée. */
export function overdueOf(admin: TeamExtras, supplierId: string): Exchange | null {
  const last = admin.exchanges.filter((e) => e.supplier_id === supplierId).sort((a, b) => b.exchanged_at.localeCompare(a.exchanged_at))[0];
  return last?.next_action_at && new Date(last.next_action_at) < new Date() ? last : null;
}

export function SupplierExchanges({ supplier, admin, api }: { supplier: Supplier; admin: TeamExtras; api: WorkspaceApi }) {
  const [adding, setAdding] = useState(false);
  const [compose, setCompose] = useState(false);
  const list = admin.exchanges.filter((e) => e.supplier_id === supplier.id).sort((a, b) => b.exchanged_at.localeCompare(a.exchanged_at));
  const lastIn = list.find((e) => e.direction === 'in' && isAnalysis(e.analysis));
  const late = overdueOf(admin, supplier.id);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAdding((v) => !v)} className={btnPrimary}>{adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {adding ? 'Fermer' : 'Réponse reçue ou note'}</button>
        {supplier.email && <button type="button" onClick={() => setCompose(true)} className={btn}><Mail className="h-3.5 w-3.5" /> Écrire un e-mail</button>}
      </div>
      {late && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">Relance en retard depuis le {dateShort(late.next_action_at)}{late.next_action ? ` : ${late.next_action}` : ''}</p>}
      {adding && <ExchangeForm supplier={supplier} admin={admin} api={api} onDone={() => setAdding(false)} />}
      <ContactHistory contacts={contactsOf(admin, supplier.id)} />
      {list.length === 0 ? (
        <Empty>Aucun échange avec cette usine. Les e-mails envoyés depuis la plateforme et les réponses reçues apparaîtront ici.</Empty>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-700">
          {list.map((e) => <ExchangeItem key={e.id} e={e} supplier={supplier} admin={admin} api={api} open={e.id === lastIn?.id} />)}
        </ol>
      )}
      {compose && <EmailCompose supplier={supplier} admin={admin} api={api} initial={{ lot: supplier.lot }} onClose={() => setCompose(false)} />}
    </div>
  );
}

function ExchangeItem({ e, supplier, admin, api, open }: { e: Exchange; supplier: Supplier; admin: TeamExtras; api: WorkspaceApi; open: boolean }) {
  const dir = e.direction || 'note';
  const meta = { out: { icon: ArrowUpRight, label: 'Envoyé', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', dot: 'bg-sky-500' }, in: { icon: ArrowDownLeft, label: 'Reçu', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', dot: 'bg-emerald-500' }, note: { icon: NotebookPen, label: 'Note', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200', dot: 'bg-slate-400' } }[dir];
  const Icon = meta.icon;
  const analysis = isAnalysis(e.analysis) ? e.analysis : null;
  const raw = typeof (e.analysis as { raw?: unknown } | null)?.raw === 'string' ? ((e.analysis as { raw: string }).raw) : '';
  return (
    <li className="relative">
      <span className={`absolute -left-[23px] top-3 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-900 ${meta.dot}`} aria-hidden />
      <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}><Icon className="h-3 w-3" />{meta.label}</span>
            <Badge tone="slate">{EXCHANGE_CHANNELS.find((c) => c.value === e.channel)?.label || e.channel}</Badge>
            <span>{dateTime(e.exchanged_at)}</span>
            {e.author_name && <span>· {e.author_name}</span>}
          </span>
          <button type="button" onClick={() => { if (confirm('Supprimer cet échange ?')) api.act('exchange.delete', { id: e.id }); }} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{e.summary}</p>
        {raw && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">Message d’origine</summary>
            <pre className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-sans text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{raw}</pre>
          </details>
        )}
        <AttachmentList items={e.attachments} />
        {analysis && (
          <details className="mt-2 rounded-xl border border-violet-100 px-3 py-2 dark:border-violet-900" open={open}>
            <summary className="cursor-pointer text-xs font-semibold text-violet-700 dark:text-violet-300">Analyse : réponse proposée, explication, questions de l’usine{analysis.factory_questions.length ? ` (${analysis.factory_questions.length})` : ''}</summary>
            <div className="mt-2"><ExchangeAnalysisPanel analysis={analysis} supplier={supplier} admin={admin} api={api} exchangeId={e.id} compact /></div>
          </details>
        )}
        {e.next_action && <p className="mt-2 text-xs"><span className="font-semibold text-amber-700">À faire :</span> {e.next_action}{e.next_action_at ? ` (${dateShort(e.next_action_at)})` : ''}</p>}
      </div>
    </li>
  );
}

/** Ajout d'un échange pour l'usine : texte collé et/ou captures, analyse, enregistrement. */
function ExchangeForm({ supplier, admin, api, onDone }: { supplier: Supplier; admin: TeamExtras; api: WorkspaceApi; onDone: () => void }) {
  const [f, setF] = useState({ direction: 'in' as Direction, channel: supplier.preferred_channel === 'whatsapp' || supplier.preferred_channel === 'wechat' ? supplier.preferred_channel : 'email', exchanged_at: new Date().toISOString().slice(0, 16), summary: '', next_action: '', next_action_at: '' });
  const [raw, setRaw] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [analysis, setAnalysis] = useState<ExchangeAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState('');
  const [err, setErr] = useState('');
  const analyze = async () => {
    setAiBusy(true);
    setErr('');
    try {
      const ids = files.map((a) => /\/documents\/([0-9a-f-]{36})$/i.exec(a.url || '')?.[1]).filter((x): x is string => !!x);
      const r = await api.ai('exchange.analyze', { document_ids: ids, notes: [raw, f.summary].filter((x) => x.trim()).join('\n\n'), supplier_id: supplier.id });
      const res = r.result as ExchangeAnalysis;
      const figures = res.key_figures?.length ? `\n\nChiffres cités : ${res.key_figures.join(' · ')}` : '';
      setAnalysis(res);
      setF((x) => ({
        ...x,
        direction: 'in',
        summary: `${res.summary}${figures}`,
        channel: ['wechat', 'email', 'whatsapp', 'phone', 'visit', 'other'].includes(res.channel) ? res.channel : x.channel,
        next_action: res.next_action || x.next_action,
        next_action_at: res.next_action_days != null && !x.next_action_at ? new Date(Date.now() + res.next_action_days * 86_400_000).toISOString().slice(0, 10) : x.next_action_at,
      }));
      const u = r.usage as { model: string; costFcfa: number };
      setAiInfo(`${u.model} · ${u.costFcfa} FCFA — à relire avant d’envoyer`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Analyse impossible');
    } finally {
      setAiBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.act('exchange.add', { ...f, summary: f.summary.trim() || raw.trim().slice(0, 4000), supplier_id: supplier.id, exchanged_at: f.exchanged_at ? new Date(f.exchanged_at).toISOString() : undefined, next_action_at: f.next_action_at ? new Date(f.next_action_at).toISOString() : null, attachments: files, analysis: analysis ? { ...analysis, raw: raw.trim().slice(0, 20000) || null } : raw.trim() ? { raw: raw.trim().slice(0, 20000) } : null });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/10">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={label}>Type</label><select className={input} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as Direction })}>{DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
        <div><label className={label}>Canal</label><select className={input} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{EXCHANGE_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        <div><label className={label}>Date et heure</label><input type="datetime-local" className={input} value={f.exchanged_at} onChange={(e) => setF({ ...f, exchanged_at: e.target.value })} /></div>
      </div>
      <div><label className={label}>Message de l’usine (coller la conversation, l’e-mail…)</label><textarea className={`${input} font-mono text-xs`} rows={6} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Collez ici la réponse de l’usine (chinois, anglais ou français), ou joignez des captures." /></div>
      <div>
        <AttachmentList items={files} onRemove={(i) => setFiles((x) => x.filter((_, k) => k !== i))} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AttachButton api={api} internal category="misc" label="Joindre des captures" accept="image/*,application/pdf,.eml,.txt" onAttached={(a) => setFiles((x) => [...x, ...a])} />
          <button type="button" disabled={aiBusy || (!files.some((a) => a.kind === 'image') && !raw.trim())} onClick={analyze} className={btnPrimary}>{aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Analyser et proposer une réponse</button>
          {aiInfo && <span className="text-[11px] text-slate-500">{aiInfo}</span>}
        </div>
      </div>
      <div><label className={label}>Résumé (ce qui a été dit, promis, chiffré)</label><textarea className={input} rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div><label className={label}>À faire ensuite</label><input className={input} value={f.next_action} onChange={(e) => setF({ ...f, next_action: e.target.value })} placeholder="Ex. relancer pour le rapport SGS" /></div>
        <div><label className={label}>Relance prévue</label><input type="date" className={input} value={f.next_action_at} onChange={(e) => setF({ ...f, next_action_at: e.target.value })} /></div>
      </div>
      {analysis && <div className="border-t border-emerald-200 pt-3 dark:border-emerald-900"><ExchangeAnalysisPanel analysis={analysis} supplier={supplier} admin={admin} api={api} /></div>}
      {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || (!f.summary.trim() && !raw.trim() && !files.length)} onClick={save} className={btnPrimary}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Enregistrer dans le fil{analysis ? ' avec l’analyse' : ''}</button>
        <button type="button" onClick={onDone} className={btn}>Annuler</button>
      </div>
    </div>
  );
}
