'use client';

// Onglet « Projets » : éléments partagés entre la surface équipe (/admin/projets)
// et la surface client (/projet/<jeton>) — appels, envoi de fichiers, badges,
// fenêtre modale, pièces jointes, mise en forme.

import { useEffect, useState, type ReactNode } from 'react';
import { FileText, Image as ImageIcon, Loader2, Paperclip, X } from 'lucide-react';
import type { Attachment } from '@/lib/projects/types';

export type Mode = 'team' | 'client';

/** Point d'entrée des appels : actions JSON, envoi de fichiers, rechargement. */
export interface WorkspaceApi {
  mode: Mode;
  act: (action: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  upload: (files: File[], opts?: { category?: string; internal?: boolean }) => Promise<{ id: string; attachment: Attachment }[]>;
  reload: () => Promise<void>;
  /** Assistants IA (équipe seulement) : plan, résumé d'échange, brouillon de journal. */
  ai: (action: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  viewerName: string;
  /** Adresse de base du projet (…/api/projects/<id> ou …/public/<jeton>) pour les routes annexes. */
  baseUrl: string;
}

// Centimes seulement quand il y en a (prix unitaires à 7,50 $ ; totaux ronds sans « ,00 »).
export const money = (n: number | null | undefined, currency: string) => (n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n));
export const dateShort = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const size = (n: number | null | undefined) => (n == null ? '' : n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

// Mobile d'abord : cibles tactiles d'au moins 40 px, champs en 16 px (sinon
// iOS zoome à chaque saisie), tailles réduites à partir de « sm ».
export const card = 'rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-4';
export const btn = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 sm:min-h-0 sm:py-1.5 sm:text-xs';
export const btnPrimary = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 sm:min-h-0 sm:py-1.5 sm:text-xs';
export const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:py-2 sm:text-sm';
export const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500';

export function Badge({ tone = 'slate', children }: { tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'blue' | 'violet'; children: ReactNode }) {
  const t: Record<string, string> = { slate: 'bg-slate-100 text-slate-600', emerald: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', blue: 'bg-blue-100 text-blue-700', violet: 'bg-violet-100 text-violet-700' };
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${t[tone]}`}>{children}</span>;
}

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  // Échap ferme la fenêtre ; la page derrière ne défile pas tant qu'elle est ouverte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    // Mobile : feuille plein largeur depuis le bas, en-tête collant, marge de la barre d'accueil iOS.
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-h-[90vh] sm:rounded-3xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-5 sm:pt-5">
          <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" aria-hidden />
          <div className="min-w-0 pt-1 sm:pt-0">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white sm:text-lg">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">{children}</div>
      </div>
    </div>
  );
}

export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove?: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((a, i) => (
        <li key={`${a.url}-${i}`} className="group relative">
          {a.kind === 'image' ? (
            <a href={a.url} target="_blank" rel="noopener noreferrer" title={a.name} className="block h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
            </a>
          ) : (
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="max-w-[12rem] truncate font-medium sm:max-w-[10rem]">{a.name}</span>
              <span className="text-slate-400">{size(a.size)}</span>
            </a>
          )}
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white sm:hidden sm:p-0.5 sm:group-hover:block" aria-label="Retirer"><X className="h-3.5 w-3.5 sm:h-3 sm:w-3" /></button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Bouton « Joindre » : envoie les fichiers puis renvoie les pièces jointes créées. */
export function AttachButton({ api, onAttached, category = 'misc', internal = false, label: text = 'Joindre', accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.eml' }: { api: WorkspaceApi; onAttached: (a: Attachment[]) => void; category?: string; internal?: boolean; label?: string; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <span className="inline-flex flex-col">
      <label className={`${btn} cursor-pointer`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} {text}
        <input
          type="file"
          multiple
          accept={accept}
          className="hidden"
          disabled={busy}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            if (!files.length) return;
            setBusy(true);
            setErr('');
            try {
              const docs = await api.upload(files, { category, internal });
              onAttached(docs.map((d) => d.attachment));
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Envoi impossible');
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {err && <span className="mt-1 text-[11px] text-red-600">{err}</span>}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function AuthorChip({ author, name }: { author: 'team' | 'client'; name: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${author === 'client' ? 'bg-sky-100 text-sky-800' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}>{author === 'client' ? `Client · ${name}` : name}</span>;
}

export { ImageIcon };
