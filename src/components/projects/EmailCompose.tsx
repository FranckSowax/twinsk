'use client';

// Fenêtre d'envoi d'un e-mail à une usine depuis la plateforme (Resend),
// expéditeur de l'entreprise (ex. sourcing@…). Préremplie depuis « Messages
// usines » (RFQ) ou vide depuis « Usines & échanges ». L'envoi est noté dans
// les échanges avec l'usine ; les réponses arrivent dans la boîte d'envoi.

import { useState } from 'react';
import { CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import type { TeamExtras } from '@/lib/projects/public-server';
import { Modal, btn, btnPrimary, input, label, type WorkspaceApi } from './shared';
import { CHANNEL_LABEL, ContactHistory, contactsOf } from './ContactTrace';

export function EmailCompose({ supplier, admin, api, initial, onClose }: { supplier: TeamExtras['suppliers'][number]; admin: TeamExtras; api: WorkspaceApi; initial?: { subject?: string; body?: string; lot?: string; replyToExchange?: string }; onClose: () => void }) {
  const [f, setF] = useState({ to: supplier.email || '', cc: '', subject: initial?.subject || '', body: initial?.body || '' });
  // Une clé par fenêtre : un double clic ou une requête rejouée n'envoie pas deux fois.
  const [nonce] = useState(() => Math.random().toString(36).slice(2) + Date.now().toString(36));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState<string[] | null>(null);
  const placeholders = [...new Set(`${f.subject}\n${f.body}`.match(/\[[^\]\n]{1,40}\]/g) || [])];
  const previous = contactsOf(admin, supplier.id);
  const send = async () => {
    if (previous.length && !confirm(`Cette usine a déjà été contactée le ${new Date(previous[0].at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} (${CHANNEL_LABEL[previous[0].channel] || previous[0].channel}). Envoyer quand même ?`)) return;
    if (placeholders.length && !confirm(`Il reste des champs à compléter : ${placeholders.join(' ')}. Envoyer quand même ?`)) return;
    setBusy(true);
    setErr('');
    try {
      const r = await api.act('email.send', { supplier_id: supplier.id, ...f, nonce, lot: initial?.lot, reply_to_exchange: initial?.replyToExchange });
      setSent((r.to as string[]) || [f.to]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };
  if (!admin.email.configured) {
    return (
      <Modal title="Envoyer un e-mail" onClose={onClose}>
        <p className="text-sm text-slate-700 dark:text-slate-200">L’envoi d’e-mails depuis la plateforme n’est pas encore configuré (clé Resend absente sur le serveur).</p>
        <p className="mt-2 text-xs text-slate-500">En attendant, utilisez « Ouvrir dans ma messagerie » ou copiez le message.</p>
        <button type="button" onClick={onClose} className={`${btn} mt-4`}>Fermer</button>
      </Modal>
    );
  }
  return (
    <Modal title={<span className="flex items-center gap-2"><Mail className="h-4 w-4" /> E-mail à {supplier.real_name || supplier.alias}</span>} onClose={onClose} wide>
      {sent ? (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> E-mail envoyé à {sent.join(', ')}</p>
          <p className="text-xs text-slate-500">Noté dans « Échanges avec les usines », avec une relance proposée dans 3 jours. Les réponses arriveront dans la boîte {admin.email.from}.</p>
          <button type="button" onClick={onClose} className={btnPrimary}>Fermer</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">De : <b>{admin.email.from}</b> · les réponses arrivent dans cette boîte.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>À</label><input className={input} type="email" inputMode="email" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} placeholder="sales@usine.com" /></div>
            <div><label className={label}>Cc (facultatif)</label><input className={input} inputMode="email" value={f.cc} onChange={(e) => setF({ ...f, cc: e.target.value })} placeholder="collègue@…, séparées par des virgules" /></div>
          </div>
          <div><label className={label}>Objet</label><input className={input} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div><label className={label}>Message</label><textarea className={`${input} font-mono text-xs`} rows={14} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          {placeholders.length > 0 && <p className="text-[11px] text-amber-700">À compléter : {placeholders.join(' ')}</p>}
          <ContactHistory contacts={previous} />
          {supplier.watch_points?.length ? <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">⚠ {supplier.watch_points.join(' · ')}</p> : null}
          {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !f.to.trim() || !f.subject.trim() || !f.body.trim()} onClick={send} className={btnPrimary}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Envoyer depuis {admin.email.from}</button>
            <button type="button" onClick={onClose} className={btn}>Annuler</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Petit formulaire « Tester l'envoi » (vérifie la configuration Resend). */
export function EmailTest({ admin, api }: { admin: TeamExtras; api: WorkspaceApi }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        Envoi par e-mail depuis la plateforme : {admin.email.configured ? <span className="text-emerald-700">actif — expéditeur {admin.email.from}</span> : <span className="text-amber-700">non configuré (clé Resend absente sur le serveur)</span>}
      </p>
      {admin.email.configured && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className={`${input} sm:max-w-xs`} type="email" inputMode="email" placeholder="Votre adresse, pour un essai" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" disabled={busy || !to.trim()} onClick={async () => { setBusy(true); setMsg(''); try { await api.act('email.test', { to }); setMsg('E-mail d’essai envoyé : vérifiez la boîte de réception (et les indésirables).'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Échec'); } finally { setBusy(false); } }} className={btn}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Tester l’envoi</button>
          {msg && <span className="text-[11px] text-slate-600 dark:text-slate-300">{msg}</span>}
        </div>
      )}
    </div>
  );
}
