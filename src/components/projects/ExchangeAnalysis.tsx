'use client';

// Analyse d'un échange avec une usine (équipe) : explication et réflexion,
// réponse proposée (anglais, français pour relecture, chinois si l'usine
// écrit en chinois) à copier ou envoyer, et questions de l'usine à poser au
// client — reformulées sans nom d'usine, le lien reste interne.

import { useState } from 'react';
import { Check, CheckCheck, CheckCircle2, Copy, HelpCircle, Lightbulb, Loader2, MessageCircle, Send, Tag } from 'lucide-react';
import type { TeamExtras } from '@/lib/projects/public-server';
import type { ExchangeAnalysis as Analysis } from '@/lib/projects/ai';
import { fillPlaceholders, whatsappLink } from '@/lib/projects/rfq';
import { EmailCompose } from './EmailCompose';
import { OfferEditor, pendingOffer } from './Offers';
import type { PublicProject } from '@/lib/projects/public';
import { btn, btnPrimary, input, type WorkspaceApi } from './shared';

type Supplier = TeamExtras['suppliers'][number];

export function ExchangeAnalysisPanel({ analysis, supplier, p, admin, api, exchangeId = null, raw = null, compact = false, onQuestionsSent }: { analysis: Analysis; supplier: Supplier | null; p?: PublicProject; admin: TeamExtras; api: WorkspaceApi; exchangeId?: string | null; raw?: string | null; compact?: boolean; onQuestionsSent?: (ids: string[]) => void }) {
  const fill = (t: string) => fillPlaceholders(t, { factory: supplier?.real_name, contact: supplier?.contact_name, sender: admin.rfq_sender });
  const langs = [
    { key: 'en', label: 'Anglais (à envoyer)', text: fill(analysis.reply_en) },
    { key: 'fr', label: 'Français (relecture)', text: fill(analysis.reply_fr) },
    ...(analysis.reply_zh ? [{ key: 'zh', label: '中文 (WeChat)', text: fill(analysis.reply_zh) }] : []),
  ].filter((l) => l.text);
  const [lang, setLang] = useState(langs[0]?.key || 'en');
  const [copied, setCopied] = useState(false);
  const [compose, setCompose] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const offer = analysis.price_offer || null;
  const savedOffer = exchangeId ? admin.offers.find((o) => o.exchange_id === exchangeId) : null;
  const sent = analysis.reply_sent || null;
  // Réponse partie hors plateforme : notée dans le fil (message envoyé) et sur cet échange.
  const markSent = async (channel: string) => {
    if (!exchangeId || !current) return;
    setMarking(true);
    try {
      await api.act('exchange.reply_sent', { exchange_id: exchangeId, channel, text: current.text });
    } finally {
      setMarking(false);
    }
  };
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
          <div className="border-t border-slate-100 px-3 py-2 text-[11px] dark:border-slate-700">
            {sent ? (
              <p className="flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Réponse envoyée le {new Date(sent.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} par {CHANNELS[sent.channel] || sent.channel}{sent.via === 'platform' ? ' depuis la plateforme' : ''}{sent.by ? ` · ${sent.by}` : ''}</p>
            ) : exchangeId ? (
              <span className="flex flex-wrap items-center gap-1.5 text-slate-500">
                Envoyée hors plateforme ?
                {(['whatsapp', 'wechat', 'email'] as const).map((ch) => (
                  <button key={ch} type="button" disabled={marking} onClick={() => markSent(ch)} className={`${btn} !min-h-8 !px-2 !text-[11px]`}><CheckCheck className="h-3 w-3" /> J’ai envoyé cette réponse par {CHANNELS[ch]}</button>
                ))}
              </span>
            ) : (
              <span className="text-slate-500">Après l’envoi par WhatsApp ou copier-coller : enregistrez dans le fil, puis cliquez « J’ai envoyé cette réponse ». Un envoi par e-mail depuis la plateforme est noté tout seul.</span>
            )}
          </div>
        </div>
      )}
      {offer && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-100"><Tag className="h-3.5 w-3.5" /> Prix trouvés dans ce message ({offer.items.length} ligne{offer.items.length > 1 ? 's' : ''}, {offer.currency}{offer.incoterm ? ` ${offer.incoterm}` : ''})</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700 dark:text-slate-200">
            {offer.items.slice(0, 6).map((i) => <li key={i.id}>{i.kind === 'option' ? '+ ' : i.kind === 'fee' ? 'Frais : ' : ''}{i.label}{Object.keys(i.variant).length ? ` (${Object.values(i.variant).join(', ')})` : ''} — {i.price != null ? `${i.price} ${offer.currency}` : ''}{i.tiers.length ? ` ${i.tiers.map((t) => `dès ${t.min_qty} : ${t.price}`).join(' · ')}` : ''} /{i.unit}</li>)}
            {offer.items.length > 6 && <li>… et {offer.items.length - 6} autre(s)</li>}
          </ul>
          {savedOffer && pendingOffer(savedOffer) ? (
            <div className="mt-2 space-y-1">
              <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Prix enregistrés tout seuls : déjà dans l’onglet Comparaison et dans « Prix reçus ».</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">Relisez-les (ils viennent de la lecture du message) : la marge du projet s’applique, et le client ne les voit pas encore.</p>
              {supplier && p && <button type="button" onClick={() => setOfferOpen(true)} className={`${btnPrimary} mt-1`}><Tag className="h-3.5 w-3.5" /> Vérifier et montrer au client</button>}
            </div>
          ) : savedOffer ? (
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Offre vérifiée{savedOffer.client_visible ? ' et visible du client' : ', masquée au client'} (fiche › « Prix reçus » et onglet Comparaison).</p>
          ) : supplier && p ? (
            <button type="button" onClick={() => setOfferOpen(true)} className={`${btnPrimary} mt-2`}><Tag className="h-3.5 w-3.5" /> Vérifier et enregistrer l’offre de prix</button>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">Rattachez l’échange à une usine : l’offre s’enregistrera alors toute seule.</p>
          )}
        </div>
      )}
      {analysis.factory_questions.length > 0 && <FactoryQuestions analysis={analysis} supplier={supplier} admin={admin} api={api} exchangeId={exchangeId} onSent={onQuestionsSent} />}
      {offerOpen && supplier && p && offer && <OfferEditor supplier={supplier} p={p} admin={admin} api={api} offer={savedOffer} initial={savedOffer ? null : offer} exchangeId={exchangeId} raw={raw} onClose={() => setOfferOpen(false)} />}
      {compose && supplier && current && <EmailCompose supplier={supplier} admin={admin} api={api} initial={{ subject: rfq?.email_subject_en ? `Re: ${fill(rfq.email_subject_en)}` : '', body: current.text, lot: supplier.lot, replyToExchange: exchangeId || undefined }} onClose={() => setCompose(false)} />}
    </div>
  );
}

/** Comparaison souple (casse, accents, ponctuation) pour reconnaître une question déjà posée. */
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim();
const CHANNELS: Record<string, string> = { whatsapp: 'WhatsApp', wechat: 'WeChat', email: 'e-mail', other: 'autre canal' };

/** Questions posées par l'usine : à poser au client (cochées si seul le client peut répondre) ; celles déjà posées sont marquées. */
function FactoryQuestions({ analysis, supplier, admin, api, exchangeId, onSent }: { analysis: Analysis; supplier: Supplier | null; admin: TeamExtras; api: WorkspaceApi; exchangeId: string | null; onSent?: (ids: string[]) => void }) {
  const [items, setItems] = useState(analysis.factory_questions.map((q) => ({ ...q, checked: q.needs_client })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Déjà posées : questions au client de cette usine (ou de cet échange) dont le texte correspond.
  const asked = (admin.asked_questions || []).filter((a) => (supplier && a.supplier_id === supplier.id) || (exchangeId && a.exchange_id === exchangeId));
  const askedFor = (fr: string) => {
    const k = norm(fr);
    if (!k) return null;
    return asked.find((a) => {
      const t = norm(`${a.subject} ${a.detail}`);
      return t.includes(k.slice(0, 120)) || k.includes(norm(a.subject).replace(/ $/, '').slice(0, 120));
    }) || null;
  };
  const selected = items.filter((q) => q.checked && q.fr.trim() && !askedFor(q.fr));
  const already = items.filter((q) => askedFor(q.fr)).length;
  const send = async () => {
    setBusy(true);
    setErr('');
    try {
      const questions = selected.map((q) => {
        const t = q.fr.replace(/\s+/g, ' ').trim();
        return t.length <= 200 ? { subject: t } : { subject: `${t.slice(0, 197)}…`, detail: t };
      });
      const r = await api.act('question.to_client', { questions, lot: supplier?.lot || '', supplier_id: supplier?.id || '', exchange_id: exchangeId || '' });
      onSent?.((r.ids as string[]) || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/20">
      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-100"><HelpCircle className="h-3.5 w-3.5" /> Questions de l’usine ({items.length}){already ? ` · ${already} déjà posée${already > 1 ? 's' : ''} au client` : ''}</p>
      <p className="mt-0.5 text-[11px] text-sky-800/80 dark:text-sky-200/70">Cochées : celles que seul le client peut trancher. Relisez la formulation : le client ne doit pas savoir de quelle usine il s’agit.</p>
      <ul className="mt-2 space-y-2">
        {items.map((q, i) => {
          const a = askedFor(q.fr);
          return (
            <li key={i} className={`rounded-lg bg-white p-2 dark:bg-slate-900 ${a ? 'opacity-80' : ''}`}>
              <label className="flex items-start gap-2">
                {a ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /> : <input type="checkbox" className="mt-1 h-4 w-4" checked={q.checked} onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, checked: e.target.checked } : y)))} />}
                <span className="min-w-0 flex-1 space-y-1">
                  {a ? <span className="block text-sm text-slate-800 dark:text-slate-100">{q.fr}</span> : <textarea className={`${input} !py-1.5 !text-sm`} rows={2} value={q.fr} onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, fr: e.target.value } : y)))} />}
                  {a && <span className="block text-[11px] font-semibold text-emerald-700">✓ Posée au client le {new Date(a.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {a.status === 'answered' ? 'répondue (voir l’onglet Questions)' : 'en attente de sa réponse'}</span>}
                  {q.original && q.original !== q.fr && <span className="block text-[11px] text-slate-500">Texte d’origine : {q.original}</span>}
                  {!a && q.why && <span className="block text-[11px] text-slate-500">{q.needs_client ? 'Pour le client : ' : 'L’équipe peut répondre : '}{q.why}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {err && <p className="mt-2 text-xs text-red-600" role="alert">{err}</p>}
      {selected.length > 0 ? (
        <button type="button" disabled={busy} onClick={send} className={`${btnPrimary} mt-2`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Poser {selected.length} question{selected.length > 1 ? 's' : ''} au client</button>
      ) : already ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Questions retenues posées au client ; ses réponses arrivent dans l’onglet Questions.</p>
      ) : null}
    </div>
  );
}
