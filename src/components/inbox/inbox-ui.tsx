'use client';

// Briques partagées de la messagerie : texte avec liens cliquables, carte
// d'aperçu de lien (image de partage comme WhatsApp), sélecteur d'emoji avec
// teinte de peau (marron clair par défaut), insertion de lien (listings, page
// bio, lien collé) et insertion au curseur dans une zone de texte.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Plus, Search, Smile } from 'lucide-react';
import { splitLinks, URL_RE } from '@/lib/wa-inbox';
import type { LinkPreview } from '@/lib/link-preview';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Premier lien d'un texte (celui dont WhatsApp affiche l'aperçu). */
export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[0] : null;
}

/** Insère `value` à la position du curseur (ou à la fin) et replace le curseur après. */
export function insertAtCursor(el: HTMLTextAreaElement | null, current: string, value: string, set: (v: string) => void) {
  const start = el?.selectionStart ?? current.length;
  const end = el?.selectionEnd ?? current.length;
  const next = current.slice(0, start) + value + current.slice(end);
  set(next);
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    const pos = start + value.length;
    el.setSelectionRange(pos, pos);
  });
}

/** Texte d'un message : liens cliquables, retour à la ligne même au milieu d'une longue URL. */
export function MessageText({ text, mine }: { text: string; mine: boolean }) {
  return (
    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${mine ? 'text-emerald-800 dark:text-emerald-100' : 'text-sky-700 dark:text-sky-300'}`}>
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

// Aperçus partagés entre toutes les cartes (un lien de catalogue revient dans des dizaines de conversations).
const PREVIEWS = new Map<string, Promise<LinkPreview | null>>();
function loadPreview(url: string, fetcher: Fetcher): Promise<LinkPreview | null> {
  let p = PREVIEWS.get(url);
  if (!p) {
    p = fetcher(`/api/inbox/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.preview as LinkPreview) || null)
      .catch(() => null);
    PREVIEWS.set(url, p);
  }
  return p;
}

/** Carte d'aperçu d'un lien, comme dans WhatsApp : image de partage, titre, description, domaine. */
export function LinkPreviewCard({ url, fallbackTitle, fetcher, compact = false }: { url: string; fallbackTitle?: string | null; fetcher: Fetcher; compact?: boolean }) {
  const [preview, setPreview] = useState<LinkPreview | null | undefined>(undefined);
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => {
    let alive = true;
    loadPreview(url, fetcher).then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [url, fetcher]);
  const host = useMemo(() => {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  }, [url]);
  const title = preview?.title || fallbackTitle || null;
  const image = preview?.image && imgOk ? preview.image : null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`mb-1.5 block overflow-hidden rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/10 ${compact ? 'flex items-center gap-2' : ''}`}>
      {image &&
        (compact ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" onError={() => setImgOk(false)} className="h-14 w-14 flex-shrink-0 object-cover" loading="lazy" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" onError={() => setImgOk(false)} className="max-h-44 w-full object-cover" loading="lazy" />
        ))}
      <span className={`block min-w-0 px-2.5 py-2 ${compact ? 'flex-1' : ''}`}>
        {preview === undefined && !title ? (
          <span className="block h-3 w-2/3 animate-pulse rounded bg-black/10" />
        ) : (
          title && <span className="block truncate text-xs font-bold">{title}</span>
        )}
        {preview?.description && !compact && <span className="mt-0.5 line-clamp-2 block text-[11px] opacity-75">{preview.description}</span>}
        <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] opacity-60">
          {!image && <Link2 className="h-3 w-3 flex-shrink-0" />}
          {host}
        </span>
      </span>
    </a>
  );
}

// ---- Emoji ----
const TONES = [
  { key: '', swatch: '#FFCC4D', label: 'Jaune' },
  { key: '\u{1F3FB}', swatch: '#F7DECE', label: 'Clair' },
  { key: '\u{1F3FC}', swatch: '#E0BB95', label: 'Moyen clair' },
  { key: '\u{1F3FD}', swatch: '#BF8F68', label: 'Marron clair' },
  { key: '\u{1F3FE}', swatch: '#9B643D', label: 'Marron foncé' },
  { key: '\u{1F3FF}', swatch: '#594539', label: 'Foncé' },
];
const DEFAULT_TONE = '\u{1F3FD}'; // marron clair
const TONE_KEY = 'inbox_emoji_tone';
/** Emoji qui acceptent une teinte de peau (mains, gestes, personnes). */
const TONEABLE = ['👍', '👎', '👉', '👈', '👆', '👇', '☝', '👋', '👌', '✌', '🤞', '🤝', '🙏', '👏', '🙌', '💪', '✋', '🤙', '🫶', '🤲', '👐', '🤚', '🖐', '🙋', '🙆', '🤷', '💁', '🧑‍💼'];
const GROUPS: { label: string; items: string[] }[] = [
  { label: 'Mains', items: TONEABLE },
  { label: 'Visages', items: ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😉', '😎', '🤩', '🥳', '😅', '😇', '🤗', '🤔', '😮', '😢', '😔', '🙂', '😌', '😴', '🤤', '😋'] },
  { label: 'Commerce', items: ['🛋️', '🛏️', '🪑', '🏠', '💼', '🛒', '🛍️', '📦', '🚚', '✈️', '🚢', '💳', '💰', '💵', '📱', '📞', '💬', '📍', '🧾', '🏷️', '🎁', '🔗', '📸', '🎬'] },
  { label: 'Symboles', items: ['✅', '☑️', '✔️', '❌', '⚠️', '⏳', '⏰', '📅', '🔥', '⭐', '✨', '💯', '❤️', '💙', '💚', '🧡', '👀', '🎉', '🆕', '🆓', '➡️', '⬇️', '🇬🇦', '🇨🇳'] },
];

function withTone(emoji: string, tone: string): string {
  // ☝ et ✌ sans teinte : sélecteur de variation pour l'affichage en couleur.
  if (!tone) return /^[☝✌]$/.test(emoji) ? `${emoji}\u{FE0F}` : emoji;
  const base = emoji.replace(/\u{FE0F}/gu, '');
  if (!TONEABLE.includes(base) && !TONEABLE.includes(emoji)) return emoji;
  // Personnes composées (🧑‍💼) : la teinte suit le premier caractère.
  const [first, ...rest] = Array.from(base);
  return [first + tone, ...rest].join('');
}

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  // Teinte mémorisée sur l'appareil ; lue à la création (la palette n'est jamais rendue côté serveur).
  const [tone, setTone] = useState(() => {
    try {
      const t = typeof window !== 'undefined' ? localStorage.getItem(TONE_KEY) : null;
      return t !== null && TONES.some((x) => x.key === t) ? t : DEFAULT_TONE;
    } catch {
      return DEFAULT_TONE;
    }
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const chooseTone = (t: string) => {
    setTone(t);
    try {
      localStorage.setItem(TONE_KEY, t);
    } catch {
      /* ignoré */
    }
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} title="Emoji" className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${open ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
        <Smile className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute bottom-11 left-0 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <div className="mb-1.5 flex items-center justify-between gap-1 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Teinte</span>
            <div className="flex gap-1">
              {TONES.map((t) => (
                <button key={t.label} type="button" title={t.label} onClick={() => chooseTone(t.key)} className={`h-5 w-5 rounded-full ring-2 ${tone === t.key ? 'ring-emerald-500' : 'ring-transparent'}`} style={{ background: t.swatch }} />
              ))}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
                <div className="grid grid-cols-8">
                  {g.items.map((e) => {
                    const v = g.label === 'Mains' ? withTone(e, tone) : e;
                    return (
                      <button key={e} type="button" onClick={() => onPick(v)} className="rounded-lg p-1 text-xl leading-none hover:bg-slate-100 dark:hover:bg-slate-700">
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Insertion de lien ----
interface OfferLite { id: string; title: string; status?: string; archived_at?: string | null; offer_type?: string | null }
let OFFERS: Promise<OfferLite[]> | null = null;

export function LinkInsertMenu({ onPick, fetcher }: { onPick: (url: string) => void; fetcher: Fetcher }) {
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState<OfferLite[]>([]);
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    if (!OFFERS) {
      OFFERS = fetcher('/api/offers')
        .then((r) => (r.ok ? r.json() : []))
        .then((l: OfferLite[]) => (Array.isArray(l) ? l.filter((o) => o.status === 'published' && !o.archived_at) : []))
        .catch(() => []);
    }
    OFFERS.then(setOffers);
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, fetcher]);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pick = (url: string) => {
    onPick(url);
    setOpen(false);
    setQ('');
    setCustom('');
  };
  const shown = offers.filter((o) => !q.trim() || o.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40);
  const customOk = /^https?:\/\/\S+\.\S+/.test(custom.trim());
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} title="Insérer un lien" className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${open ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
        <Link2 className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute bottom-11 left-0 z-30 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <div className="mb-2 flex gap-1.5">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Coller un lien https://…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900" />
            <button type="button" disabled={!customOk} onClick={() => pick(custom.trim())} className="flex items-center rounded-lg bg-slate-900 px-2 text-white disabled:opacity-30 dark:bg-white dark:text-slate-900" title="Insérer">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={() => pick(`${origin}/bio`)} className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700">
            🔗 Tous les catalogues (page lien bio)
          </button>
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un listing…" className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs dark:border-slate-600 dark:bg-slate-900" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {shown.map((o) => (
              <button key={o.id} type="button" onClick={() => pick(`${origin}/offer/${o.id}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700">
                <span className="flex-shrink-0">{o.offer_type === 'b2b' ? '💼' : '🏠'}</span>
                <span className="truncate">{o.title}</span>
              </button>
            ))}
            {offers.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">Chargement des listings…</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Contexte : pub d'origine, message cité ----
/** Libellé de la plateforme d'une pub (« FB_Ads » → Facebook). */
export function adPlatformLabel(platform: string | null | undefined): string {
  const p = (platform || '').toLowerCase();
  if (p.includes('ig') || p.includes('insta')) return 'Publicité Instagram';
  if (p.includes('fb') || p.includes('facebook')) return 'Publicité Facebook';
  return 'Publicité';
}

/** Carte de la pub par laquelle le client est arrivé, comme dans WhatsApp. */
export function AdCard({ ad }: { ad: import('@/lib/wa-inbox').AdContext }) {
  const [imgOk, setImgOk] = useState(true);
  const Wrapper = ad.url ? 'a' : 'div';
  return (
    <Wrapper
      {...(ad.url ? { href: ad.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="mb-1.5 block overflow-hidden rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/10"
    >
      {ad.image && imgOk && (
        <span className="relative block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.image} alt="" onError={() => setImgOk(false)} className="max-h-48 w-full object-cover" loading="lazy" />
          {ad.media_type === 'video' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-lg text-slate-800">▶</span>
            </span>
          )}
        </span>
      )}
      <span className="block px-2.5 py-2">
        <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">📣 {adPlatformLabel(ad.platform)}</span>
        {ad.title && <span className="block text-xs font-bold">{ad.title}</span>}
        {ad.body && <span className="mt-0.5 line-clamp-2 block whitespace-pre-line text-[11px] opacity-75">{ad.body}</span>}
        {ad.url && <span className="mt-0.5 block truncate text-[11px] opacity-60">{ad.url.replace(/^https?:\/\//, '')}</span>}
      </span>
    </Wrapper>
  );
}

/** Message auquel le client (ou nous) répond : bandeau cité au-dessus du texte. */
export function QuotedBlock({ author, text }: { author: string; text: string }) {
  return (
    <span className="mb-1.5 block rounded-lg border-l-4 border-emerald-500 bg-black/5 px-2.5 py-1.5 dark:bg-white/10">
      <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{author}</span>
      <span className="line-clamp-3 block whitespace-pre-line text-[12px] opacity-80">{text}</span>
    </span>
  );
}
