'use client';

// Onglet équipe « Messages usines » : par lot, l'e-mail RFQ (anglais) et le
// message court de premier contact (anglais et chinois), composés avec le plan
// et modifiables. Choisir une usine remplit [Factory] / [Contact] et propose
// l'envoi direct : mailto: ou wa.me avec le texte prérempli (WeChat : copier).
// La signature de l'expéditeur remplit [Name], [Company], [WhatsApp/WeChat ID], [E-mail].

import { useState } from 'react';
import { Copy, Check, Mail, MessageCircle, RefreshCw, Save, Send } from 'lucide-react';
import type { TeamExtras } from '@/lib/projects/public-server';
import { fillPlaceholders, mailtoLink, remainingPlaceholders, whatsappLink } from '@/lib/projects/rfq';
import { CONTACT_CHANNELS, type RfqMessage, type RfqSender } from '@/lib/projects/types';
import { Badge, Empty, btn, btnPrimary, card, dateTime, input, label, type WorkspaceApi } from './shared';

export function RfqTab({ admin, api }: { admin: TeamExtras; api: WorkspaceApi }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lots = [...new Set([...admin.lots, ...admin.rfq.map((r) => r.lot)])];
  return (
    <div className="space-y-4">
      <SenderCard sender={admin.rfq_sender} api={api} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Un jeu de messages par lot, composé à la création du plan. Modifiez le texte, choisissez l’usine : les crochets se remplissent et le message part par e-mail ou WhatsApp en un clic.</p>
        <button type="button" disabled={busy} onClick={async () => { if (!confirm('Recomposer tous les messages depuis le modèle ? Vos modifications seront remplacées.')) return; setBusy(true); setErr(''); try { await api.act('rfq.regenerate', {}); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={btn}><RefreshCw className="h-3.5 w-3.5" /> Tout recomposer</button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {admin.rfq.length === 0 ? (
        <Empty>Aucun message composé. Cliquez « Tout recomposer » : un message par lot sera créé depuis le modèle et les lignes de devis.</Empty>
      ) : (
        lots.filter((l) => admin.rfq.some((r) => r.lot === l)).map((lot) => <LotMessages key={lot} m={admin.rfq.find((r) => r.lot === lot)!} admin={admin} api={api} />)
      )}
    </div>
  );
}

function SenderCard({ sender, api }: { sender: Partial<RfqSender>; api: WorkspaceApi }) {
  const [f, setF] = useState<RfqSender>({ name: sender.name || '', company: sender.company || '', whatsapp: sender.whatsapp || '', wechat: sender.wechat || '', email: sender.email || '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify({ name: sender.name || '', company: sender.company || '', whatsapp: sender.whatsapp || '', wechat: sender.wechat || '', email: sender.email || '' });
  return (
    <div className={card}>
      <p className="font-display text-base font-bold text-slate-900 dark:text-white">Signature de l’expéditeur</p>
      <p className="mb-3 text-xs text-slate-500">Remplit [Name], [Company], [WhatsApp/WeChat ID] et [E-mail] dans tous les messages.</p>
      <div className="grid gap-3 sm:grid-cols-5">
        {(['name', 'company', 'whatsapp', 'wechat', 'email'] as const).map((k) => (
          <div key={k}><label className={label}>{{ name: 'Nom', company: 'Société', whatsapp: 'WhatsApp', wechat: 'WeChat ID', email: 'E-mail' }[k]}</label><input className={input} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
      </div>
      <button type="button" disabled={busy || !dirty} onClick={async () => { setBusy(true); try { await api.act('rfq.sender', { sender: f }); setSaved(true); setTimeout(() => setSaved(false), 2000); } finally { setBusy(false); } }} className={`${btnPrimary} mt-3`}>{saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />} Enregistrer la signature</button>
    </div>
  );
}

function LotMessages({ m, admin, api }: { m: RfqMessage; admin: TeamExtras; api: WorkspaceApi }) {
  const fromMessage = () => ({ email_subject_en: m.email_subject_en, email_body_en: m.email_body_en, short_en: m.short_en, short_zh: m.short_zh });
  const [f, setF] = useState(fromMessage);
  // Message recomposé ou enregistré côté serveur : le formulaire repart de la version enregistrée.
  const [seen, setSeen] = useState(m.updated_at);
  if (seen !== m.updated_at) {
    setSeen(m.updated_at);
    setF(fromMessage());
  }
  const [supplierId, setSupplierId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const suppliers = admin.suppliers.filter((s) => s.lot === m.lot && s.status !== 'rejected');
  const s = suppliers.find((x) => x.id === supplierId) || null;
  const dirty = f.email_subject_en !== m.email_subject_en || f.email_body_en !== m.email_body_en || f.short_en !== m.short_en || f.short_zh !== m.short_zh;
  const fill = (t: string) => fillPlaceholders(t, { factory: s?.real_name, contact: s?.contact_name, sender: admin.rfq_sender });
  const subject = fill(f.email_subject_en);
  const body = fill(f.email_body_en);
  const shortEn = fill(f.short_en);
  const shortZh = fill(f.short_zh);
  const missing = remainingPlaceholders(`${subject}\n${body}\n${shortEn}\n${shortZh}`);
  const mailto = mailtoLink(s?.email, subject, body);
  const waEn = whatsappLink(s?.whatsapp, shortEn);
  const waZh = whatsappLink(s?.whatsapp, shortZh);
  const channel = s?.preferred_channel ? CONTACT_CHANNELS.find((c) => c.value === s.preferred_channel)?.label : null;
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-left">
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">{m.lot}</p>
          <p className="text-xs text-slate-500">{m.product_en}{m.quantities_en ? ` — ${m.quantities_en}` : ''}</p>
        </button>
        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge tone={m.origin === 'manual' ? 'amber' : 'slate'}>{m.origin === 'manual' ? 'Modifié' : m.origin === 'ai' ? 'Plan IA' : 'Modèle'}</Badge>
          <span>{dateTime(m.updated_at)}</span>
          <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>{open ? 'Replier' : 'Ouvrir'}</button>
        </span>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <div className="min-w-[14rem] flex-1">
              <label className={label}>Usine destinataire</label>
              <select className={input} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— choisir (remplit [Factory] et [Contact]) —</option>
                {suppliers.map((x) => <option key={x.id} value={x.id}>{x.watch_points?.length ? '⚠ ' : ''}{x.alias} · {x.real_name || '(sans nom)'}{x.rank ? ` · #${x.rank}` : ''}{x.score != null ? ` · ${x.score}/25` : ''}</option>)}
              </select>
            </div>
            {s && (
              <div className="flex flex-wrap items-center gap-2">
                {channel && <Badge tone="blue">Canal conseillé : {channel}</Badge>}
                {mailto ? <a href={mailto} className={btnPrimary}><Mail className="h-3.5 w-3.5" /> E-mail à {s.email}</a> : <span className="text-[11px] text-slate-500">Pas d’e-mail enregistré</span>}
                {waEn && <a href={waEn} target="_blank" rel="noopener noreferrer" className={btnPrimary}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp EN</a>}
                {waZh && <a href={waZh} target="_blank" rel="noopener noreferrer" className={btnPrimary}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp 中文</a>}
                {s.wechat && <span className="text-[11px] text-slate-600">WeChat : <b>{s.wechat}</b> (copier le message)</span>}
              </div>
            )}
          </div>
          {s?.watch_points?.length ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">⚠ Points à surveiller avant d’envoyer</p>
              <ul className="mt-1 list-disc pl-4">{s.watch_points.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}
          {missing.length > 0 && <p className="text-[11px] text-amber-700">À compléter avant envoi : {missing.join(' ')}{!s ? ' — choisissez une usine' : ''}{!admin.rfq_sender.name ? ' — renseignez la signature' : ''}</p>}
          <Field title="E-mail RFQ — objet (EN)" value={f.email_subject_en} preview={subject} rows={1} onChange={(v) => setF({ ...f, email_subject_en: v })} />
          <Field title="E-mail RFQ — corps (EN)" value={f.email_body_en} preview={body} rows={14} onChange={(v) => setF({ ...f, email_body_en: v })} />
          <Field title="Message court WeChat / WhatsApp (EN)" value={f.short_en} preview={shortEn} rows={4} onChange={(v) => setF({ ...f, short_en: v })} />
          <Field title="Message court WeChat / WhatsApp (中文)" value={f.short_zh} preview={shortZh} rows={4} onChange={(v) => setF({ ...f, short_zh: v })} />
          {m.requirements_en.length > 0 && <p className="text-[11px] text-slate-500">Exigences du lot : {m.requirements_en.join(' · ')}</p>}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !dirty} onClick={async () => { setBusy(true); setErr(''); try { await api.act('rfq.save', { lot: m.lot, ...f }); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={btnPrimary}><Save className="h-3.5 w-3.5" /> Enregistrer les textes</button>
            <button type="button" disabled={busy} onClick={async () => { if (!confirm(`Recomposer les messages du lot ${m.lot} depuis le modèle ?`)) return; setBusy(true); setErr(''); try { await api.act('rfq.regenerate', { lot: m.lot }); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={btn}><RefreshCw className="h-3.5 w-3.5" /> Recomposer ce lot</button>
            {s && <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Send className="h-3 w-3" /> Après envoi, notez l’échange dans « Usines & échanges ».</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ title, value, preview, rows, onChange }: { title: string; value: string; preview: string; rows: number; onChange: (v: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label className={`${label} mb-0`}>{title}</label>
        <span className="flex gap-1">
          <button type="button" onClick={() => setShowPreview((p) => !p)} className={btn}>{showPreview ? 'Modifier' : 'Aperçu rempli'}</button>
          <button type="button" onClick={copy} className={btn}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copier{copied ? ' ✓' : ''}</button>
        </span>
      </div>
      {showPreview ? <pre className="whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-2 font-sans text-sm text-slate-800 dark:border-emerald-800 dark:bg-emerald-900/10 dark:text-slate-100">{preview}</pre> : <textarea className={`${input} font-mono text-xs`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
