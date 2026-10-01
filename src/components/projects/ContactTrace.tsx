'use client';

// Trace des contacts avec les usines : badge « Contactée le … » et
// historique (e-mails envoyés par la plateforme, envois notés à la main —
// WhatsApp, WeChat, messagerie personnelle, Alibaba). Équipe seulement.

import { CheckCheck, Mail, MessageCircle } from 'lucide-react';
import type { SupplierContact, TeamExtras } from '@/lib/projects/public-server';

export const CHANNEL_LABEL: Record<string, string> = { email: 'e-mail', whatsapp: 'WhatsApp', wechat: 'WeChat', phone: 'téléphone', alibaba: 'Alibaba', other: 'autre canal' };
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function contactsOf(admin: TeamExtras, supplierId: string): SupplierContact[] {
  return (admin.contacts || []).filter((c) => c.supplier_id === supplierId);
}

/** « ✓ Contactée le 1 oct. · e-mail ×2 » ; rien si jamais contactée (sauf showNever). */
export function ContactBadge({ contacts, showNever = false }: { contacts: SupplierContact[]; showNever?: boolean }) {
  if (!contacts.length) return showNever ? <span className="text-[11px] font-normal text-slate-400">Pas encore contactée</span> : null;
  const last = contacts[0];
  const Icon = last.channel === 'email' ? Mail : MessageCircle;
  const title = contacts.map((c) => `${day(c.at)} · ${CHANNEL_LABEL[c.channel] || c.channel}${c.via === 'platform' ? ' (plateforme)' : ''}${c.subject ? ` · ${c.subject}` : ''}${c.by ? ` · ${c.by}` : ''}`).join('\n');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" title={title}>
      <Icon className="h-3 w-3" /> Contactée le {day(last.at)} · {CHANNEL_LABEL[last.channel] || last.channel}{contacts.length > 1 ? ` ×${contacts.length}` : ''}
    </span>
  );
}

/** Liste détaillée des contacts d'une usine (plus récent d'abord). */
export function ContactHistory({ contacts }: { contacts: SupplierContact[] }) {
  if (!contacts.length) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
      <p className="flex items-center gap-1 font-semibold"><CheckCheck className="h-3.5 w-3.5" /> Déjà contactée {contacts.length} fois</p>
      <ul className="mt-1 space-y-0.5">
        {contacts.slice(0, 6).map((c, i) => (
          <li key={i}>
            {new Date(c.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {CHANNEL_LABEL[c.channel] || c.channel}
            {c.via === 'platform' ? ' depuis la plateforme' : ' (noté à la main)'}
            {c.to.length ? ` → ${c.to.join(', ')}` : ''}
            {c.subject ? ` · « ${c.subject.length > 70 ? `${c.subject.slice(0, 70)}…` : c.subject} »` : ''}
            {c.by ? ` · ${c.by}` : ''}
          </li>
        ))}
        {contacts.length > 6 && <li className="text-emerald-700/70">… et {contacts.length - 6} autre(s), voir « Échanges avec les usines »</li>}
      </ul>
    </div>
  );
}
