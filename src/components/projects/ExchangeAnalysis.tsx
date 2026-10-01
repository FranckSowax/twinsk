'use client';

// Analyse d'un échange avec une usine (équipe) : explication et réflexion,
// réponse proposée (anglais, français pour relecture, chinois si l'usine
// écrit en chinois) à copier ou envoyer, et questions de l'usine à poser au
// client — reformulées sans nom d'usine, le lien reste interne.

import { useState } from 'react';
import { Check, CheckCircle2, Copy, HelpCircle, Lightbulb, Loader2, MessageCircle, Send } from 'lucide-react';
import type { TeamExtras } from '@/lib/projects/public-server';
import type { ExchangeAnalysis as Analysis } from '@/lib/projects/ai';
import { fillPlaceholders, whatsappLink } from '@/lib/projects/rfq';
import { EmailCompose } from './EmailCompose';
import { btn, btnPrimary, input, type WorkspaceApi } from './shared';

type Supplier = TeamExtras['suppliers'][number];

export function ExchangeAnalysisPanel({ analysis, supplier, admin, api, exchangeId = null, compact = false }: { analysis: Analysis; supplier: Supplier | null; admin: TeamExtras; api: WorkspaceApi; exchangeId?: string | null; compact?: boolean }) {
  const fill = (t: string) => fillPlaceholders(t, { factory: supplier?.real_name, contact: supplier?.contact_name, sender: admin.rfq_sender });
  const langs = [
    { key: 'en', label: 'Anglais (à envoyer)', text: fill(analysis.reply_en) },
    { key: 'fr', label: 'Français (relecture)', text: fill(analysis.reply_fr) },
    ...(analysis.reply_zh ? [{ key: 'zh', label: '中文 (WeChat)', text: fill(analysis.reply_zh) }] : []),
  ].filter((l) => l.text);
  const [lang, setLang] = useState(langs[0]?.key || 'en');
  const [copied, setCopied] = useState(false);
  const [compose, setCompose] = useState(false);
  const current = langs.find((l) => l.key === lang) || langs[0];
  const rfq = supplier ? admin.rfq.find((r) => r.lot === supplier.lot) : null;
  const wa = supplier?.whatsapp && current ? whatsappLink(supplier.whatsapp, current.text) : null;
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(current?.text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div className="space-y-3">
      {analysis.analysis && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider"><Lightbulb className="h-3.5 w-3.5" /> Explication et réflexion</p>
          <p className="whitespace-pre-wrap">{analysis.analysis}</p>
        </div>
      )}
      {current && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Réponse proposée</p>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {langs.map((l) => <button key={l.key} type="button" onClick={() => setLang(l.key)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${lang === l.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>{l.label}</button>)}
            </div>
          </div>
          <pre className={`${compact ? 'max-h-48' : 'max-h-80'} overflow-y-auto whitespace-pre-wrap px-3 py-2 font-sans text-sm text-slate-800 dark:text-slate-100`}>{current.text}</pre>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-700">
            <button type="button" onClick={copy} className={btn}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copier</button>
            {supplier?.email && lang !== 'fr' && <button type="button" onClick={() => setCompose(true)} className={btnPrimary}><Send className="h-3.5 w-3.5" /> Envoyer par e-mail</button>}
            {wa && lang !== 'fr' && <a href={wa} target="_blank" rel="noopener noreferrer" className={btn}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
            {lang === 'fr' && <span className="self-center text-[11px] text-slate-500">Version française pour relecture : envoyer l’anglais{analysis.reply_zh ? ' ou le chinois' : ''}.</span>}
          </div>
        </div>
      )}
      {analysis.factory_questions.length > 0 && <FactoryQuestions analysis={analysis} supplier={supplier} api={api} exchangeId={exchangeId} />}
      {compose && supplier && current && <EmailCompose supplier={supplier} admin={admin} api={api} initial={{ subject: rfq?.email_subject_en ? `Re: ${fill(rfq.email_subject_en)}` : '', body: current.text, lot: supplier.lot }} onClose={() => setCompose(false)} />}
    </div>
  );
}

/** Questions posées par l'usine : à poser au client (cochées si seul le client peut répondre). */
function FactoryQuestions({ analysis, supplier, api, exchangeId }: { analysis: Analysis; supplier: Supplier | null; api: WorkspaceApi; exchangeId: string | null }) {
  const [items, setItems] = useState(analysis.factory_questions.map((q) => ({ ...q, checked: q.needs_client })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(0);
  const selected = items.filter((q) => q.checked && q.fr.trim());
  const send = async () => {
    setBusy(true);
    setErr('');
    try {
      const questions = selected.map((q) => {
        const t = q.fr.replace(/\s+/g, ' ').trim();
        return t.length <= 200 ? { subject: t } : { subject: `${t.slice(0, 197)}…`, detail: t };
      });
      await api.act('question.to_client', { questions, lot: supplier?.lot || '', supplier_id: supplier?.id || '', exchange_id: exchangeId || '' });
      setSent(questions.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/20">
      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-100"><HelpCircle className="h-3.5 w-3.5" /> Questions de l’usine ({items.length})</p>
      <p className="mt-0.5 text-[11px] text-sky-800/80 dark:text-sky-200/70">Cochées : celles que seul le client peut trancher. Relisez la formulation : le client ne doit pas savoir de quelle usine il s’agit.</p>
      <ul className="mt-2 space-y-2">
        {items.map((q, i) => (
          <li key={i} className="rounded-lg bg-white p-2 dark:bg-slate-900">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={q.checked} disabled={!!sent} onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, checked: e.target.checked } : y)))} />
              <span className="min-w-0 flex-1 space-y-1">
                <textarea className={`${input} !py-1.5 !text-sm`} rows={2} value={q.fr} disabled={!!sent} onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, fr: e.target.value } : y)))} />
                {q.original && q.original !== q.fr && <span className="block text-[11px] text-slate-500">Texte d’origine : {q.original}</span>}
                {q.why && <span className="block text-[11px] text-slate-500">{q.needs_client ? 'Pour le client : ' : 'L’équipe peut répondre : '}{q.why}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 text-xs text-red-600" role="alert">{err}</p>}
      {sent ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {sent} question{sent > 1 ? 's' : ''} envoyée{sent > 1 ? 's' : ''} au client (onglet Questions) ; il est prévenu.</p>
      ) : (
        <button type="button" disabled={busy || !selected.length} onClick={send} className={`${btnPrimary} mt-2`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Poser {selected.length || ''} question{selected.length > 1 ? 's' : ''} au client</button>
      )}
    </div>
  );
}
