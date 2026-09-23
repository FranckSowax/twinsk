'use client';

// Messagerie WhatsApp (/admin/inbox). Deux volets : conversations (filtres
// À répondre / Les miennes / Toutes / Clôturées, recherche) et fil de la
// conversation choisie, avec réponse, attribution, note interne, phrases
// rapides, médiathèque et panier client. Aucun effet sur le fil WhatsApp
// lui-même : seul le suivi (qui a répondu, statut) vit ici. Rafraîchi par
// interrogation régulière (liste 10 s, fil 6 s).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock, FileText, History, Image as ImageIcon, Loader2, Lock, Paperclip, RefreshCw, Search, Send, ShoppingCart, Smartphone, Unlock, UserCheck, Users, X, Zap } from 'lucide-react';
import ClientCartPanel from '@/components/admin/whatsapp/ClientCartPanel';
import QuickRepliesEditor from './QuickRepliesEditor';
import { EmojiPicker, firstUrl, insertAtCursor, LinkInsertMenu, LinkPreviewCard, MessageText } from './inbox-ui';
import { fillTemplate, formatPhone, type InboxFilter, type QuickReply } from '@/lib/wa-inbox';
import type { ConversationRow, MessageRow, InboxActor } from '@/lib/wa-inbox-data';

interface MediaItem { id: string; url: string; kind: 'image' | 'video'; title: string; caption: string; active: boolean }

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'todo', label: 'À répondre' },
  { key: 'mine', label: 'Les miennes' },
  { key: 'all', label: 'Toutes' },
  { key: 'closed', label: 'Clôturées' },
];

function relTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400 && d.getDate() === new Date().getDate()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * 86400) return d.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function initials(name: string | null, phone: string): string {
  const n = (name || '').trim();
  if (n) return n.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
  return phone.slice(-2);
}
/** Étiquette de la personne qui a répondu (collaborateur, admin ou téléphone). */
function AssigneeChip({ c, actor }: { c: ConversationRow; actor: InboxActor | null }) {
  if (!c.assigned_to) return null;
  const mine = actor && c.assigned_to === actor.id;
  const admin = c.assigned_to === 'admin';
  return (
    <span className={`inline-flex max-w-[9rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${mine ? 'bg-emerald-500 text-white' : admin ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
      <UserCheck className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{mine ? 'Moi' : c.assigned_name || 'Attribuée'}</span>
    </span>
  );
}

interface InboxPageProps {
  /** Espace agents : les requêtes partent au nom de l'agent connecté. */
  as?: 'agent';
  /** Hauteur du bloc (dépend de la mise en page qui l'accueille). */
  heightClass?: string;
  /** Titre masqué quand la page hôte a déjà le sien. */
  hideTitle?: boolean;
  /** Compteur « à répondre », pour la pastille de la barre latérale de l'hôte. */
  onCounts?: (c: { todo: number; mine: number }) => void;
}

/** Coches WhatsApp : 1 grise = envoyé, 2 grises = reçu, 2 bleues = lu. Sans accusé connu : 1 coche. */
function Receipt({ status, className = 'h-3.5 w-3.5' }: { status?: string | null; className?: string }) {
  if (status === 'read' || status === 'played') return <CheckCheck className={`${className} text-[#53bdeb]`} aria-label="Lu" />;
  if (status === 'delivered') return <CheckCheck className={`${className} opacity-70`} aria-label="Reçu" />;
  if (status === 'pending') return <Clock className={`${className} opacity-70`} aria-label="En attente" />;
  if (status === 'failed') return <AlertCircle className={`${className} text-red-500`} aria-label="Échec d’envoi" />;
  return <Check className={`${className} opacity-70`} aria-label="Envoyé" />;
}

export default function InboxPage({ as, heightClass = 'h-[calc(100dvh-7.5rem)]', hideTitle = false, onCounts }: InboxPageProps = {}) {
  // Toutes les requêtes de la messagerie : identité explicite dans l'espace agents.
  const api = useCallback(
    (url: string, init: RequestInit = {}) =>
      fetch(url, as === 'agent' ? { ...init, headers: { ...(init.headers || {}), 'x-inbox-as': 'agent' } } : init),
    [as],
  );
  const [actor, setActor] = useState<InboxActor | null>(null);
  const [filter, setFilter] = useState<InboxFilter>('todo');
  const [q, setQ] = useState('');
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [counts, setCounts] = useState({ todo: 0, mine: 0 });
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<{ conversation: ConversationRow; messages: MessageRow[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'quick' | 'media' | 'cart' | 'note' | null>(null);
  const [quick, setQuick] = useState<QuickReply[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [quickEditor, setQuickEditor] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Historique WhatsApp récupéré une fois par conversation et par session.
  const synced = useRef<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Coches de la liste : les conversations dont notre dernier message n'a pas
  // encore d'accusé connu sont relues chez WhatsApp, une à une, une fois par
  // session. Seulement si la colonne existe (migration 60 appliquée).
  const receiptQueue = useRef<Set<string>>(new Set());
  const receiptRunning = useRef(false);
  const queueReceiptSync = useCallback(
    (list: ConversationRow[]) => {
      for (const c of list) {
        if ('last_outbound_status' in c && !c.last_outbound_status && c.last_outbound_at) receiptQueue.current.add(c.id);
      }
      if (receiptRunning.current) return;
      receiptRunning.current = true;
      (async () => {
        for (const id of Array.from(receiptQueue.current).slice(0, 40)) {
          receiptQueue.current.delete(id);
          if (synced.current.has(id)) continue;
          synced.current.add(id);
          await api(`/api/inbox/conversations/${id}/sync`, { method: 'POST' }).catch(() => undefined);
        }
        receiptRunning.current = false;
      })();
    },
    [api],
  );

  // ---- Liste ----
  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ filter });
    if (q.trim()) params.set('q', q.trim());
    const r = await api(`/api/inbox/conversations?${params}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setListError(d.error || 'Chargement impossible');
      return;
    }
    setListError('');
    setConversations(d.conversations || []);
    queueReceiptSync(d.conversations || []);
    setCounts(d.counts || { todo: 0, mine: 0 });
    onCounts?.(d.counts || { todo: 0, mine: 0 });
    if (d.actor) setActor(d.actor);
  }, [filter, q, api, onCounts, queueReceiptSync]);
  useEffect(() => {
    loadList();
    const t = setInterval(loadList, 10_000);
    return () => clearInterval(t);
  }, [loadList]);

  // ---- Fil ----
  const loadThread = useCallback(async (id: string, scroll = false) => {
    const r = await api(`/api/inbox/conversations/${id}`);
    if (!r.ok) return;
    const d = await r.json();
    setThread(d);
    setNoteDraft(d.conversation?.note || '');
    if (scroll) setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 50);
  }, [api]);
  useEffect(() => {
    if (!selectedId) return;
    setThread(null);
    setDraft('');
    setPanel(null);
    setError('');
    loadThread(selectedId, true);
    if (!synced.current.has(selectedId)) syncHistory(selectedId);
    const t = setInterval(() => loadThread(selectedId), 6_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loadThread]);
  const messageCount = thread?.messages.length || 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messageCount]);

  // ---- Phrases rapides + médiathèque (à l'ouverture des panneaux) ----
  useEffect(() => {
    if (panel === 'quick' && !quick.length) api('/api/inbox/quick-replies').then((r) => r.json()).then((d) => setQuick(d.items || [])).catch(() => undefined);
    if (panel === 'media' && !media.length) api('/api/inbox/media').then((r) => r.json()).then((d) => setMedia(d.items || [])).catch(() => undefined);
  }, [panel, quick.length, media.length, api]);

  // Messages manquants (liens envoyés avant leur prise en charge, historique antérieur).
  const syncHistory = async (id: string) => {
    synced.current.add(id);
    setSyncing(true);
    try {
      const r = await api(`/api/inbox/conversations/${id}/sync`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.added > 0) {
        await loadThread(id, true);
        loadList();
      }
    } finally {
      setSyncing(false);
    }
  };

  const conv = thread?.conversation || conversations.find((c) => c.id === selectedId) || null;
  const client = useMemo(() => ({ name: conv?.name || null, phone: conv?.phone || null }), [conv?.name, conv?.phone]);

  const patchConv = async (body: Record<string, unknown>) => {
    if (!conv) return;
    const r = await api(`/api/inbox/conversations/${conv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error || 'Mise à jour impossible');
      return;
    }
    setThread((t) => (t ? { ...t, conversation: d.conversation } : t));
    loadList();
  };

  const send = async (payload: { text?: string; media?: { url: string; kind: 'image' | 'video' | 'document'; caption?: string; filename?: string } }) => {
    if (!conv || sending) return;
    setSending(true);
    setError('');
    try {
      const r = await api(`/api/inbox/conversations/${conv.id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || 'Envoi impossible');
        return false;
      }
      setThread((t) => (t ? { ...t, messages: [...t.messages, d.message] } : t));
      await loadThread(conv.id);
      loadList();
      return true;
    } finally {
      setSending(false);
    }
  };
  const sendText = async () => {
    const text = draft.trim();
    if (!text) return;
    const ok = await send({ text });
    if (ok) setDraft('');
  };
  const insertQuick = (r: QuickReply) => {
    const t = fillTemplate(r.text, client);
    setDraft((d) => (d.trim() ? `${d.trimEnd()}\n${t}` : t));
    setPanel(null);
    setTimeout(() => textRef.current?.focus(), 0);
  };
  const sendMedia = async (m: MediaItem) => {
    const ok = await send({ media: { url: m.url, kind: m.kind, caption: mediaCaption.trim() || m.caption || undefined } });
    if (ok) {
      setMediaCaption('');
      setPanel(null);
    }
  };
  const uploadAndSend = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('files', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      const url: string | undefined = d.urls?.[0];
      if (!r.ok || !url) {
        setError(d.error || 'Téléversement impossible');
        return;
      }
      const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
      const ok = await send({ media: { url, kind, caption: mediaCaption.trim() || undefined, filename: kind === 'document' ? file.name : undefined } });
      if (ok) {
        setMediaCaption('');
        setPanel(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const mine = !!(conv && actor && conv.assigned_to === actor.id);
  const btn = 'flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700';
  const tool = (active: boolean) => `flex h-9 w-9 items-center justify-center rounded-xl transition ${active ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`;

  return (
    <div className={`flex ${heightClass} min-h-[26rem] flex-col gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideTitle && <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">Messagerie WhatsApp</h1>}
        <p className="text-xs text-slate-500">
          {actor ? `Connecté : ${actor.name}` : ''} · {counts.todo} à répondre · {counts.mine} attribuée{counts.mine > 1 ? 's' : ''} à vous
        </p>
      </div>
      {listError && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{listError}</p>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {/* ---- Liste des conversations ---- */}
        <aside className={`flex w-full flex-col border-r border-slate-200 dark:border-slate-700 md:w-80 lg:w-96 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
          <div className="space-y-2 border-b border-slate-200 p-3 dark:border-slate-700">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, numéro, message…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </div>
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((f) => {
                const n = f.key === 'todo' ? counts.todo : f.key === 'mine' ? counts.mine : null;
                const on = filter === f.key;
                return (
                  <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {f.label}
                    {n !== null && n > 0 && <span className={`rounded-full px-1.5 text-[10px] ${on ? 'bg-white/20' : f.key === 'todo' ? 'bg-red-500 text-white' : 'bg-slate-300 text-slate-700'}`}>{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 && !listError && (
              <p className="p-6 text-center text-sm text-slate-500">
                {filter === 'todo' ? 'Rien à répondre pour l’instant 🎉' : 'Aucune conversation.'}
              </p>
            )}
            {conversations.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition dark:border-slate-700/60 ${active ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}
                >
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${c.status === 'closed' ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
                    {initials(c.name, c.phone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${c.unread_count > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-100'}`}>{c.name || formatPhone(c.phone)}</span>
                      <span className="flex-shrink-0 text-[11px] text-slate-400">{relTime(c.last_message_at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`flex min-w-0 items-center gap-1 text-xs ${c.unread_count > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>
                        {c.last_outbound_at && c.last_message_at && c.last_outbound_at >= c.last_message_at && (
                          <span className="flex-shrink-0 text-slate-500"><Receipt status={c.last_outbound_status} /></span>
                        )}
                        <span className="truncate">{c.last_message_preview || '—'}</span>
                      </span>
                      {c.unread_count > 0 && <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">{c.unread_count}</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {c.name && <span className="text-[10px] text-slate-400">{formatPhone(c.phone)}</span>}
                      <AssigneeChip c={c} actor={actor} />
                      {c.status === 'closed' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Clôturée</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ---- Fil ---- */}
        <section className={`min-w-0 flex-1 flex-col ${selectedId ? 'flex' : 'hidden md:flex'}`}>
          {!conv ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
              {selectedId ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Choisissez une conversation.'}
            </div>
          ) : (
            <>
              {/* En-tête */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
                <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Retour"><ArrowLeft className="h-5 w-5" /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900 dark:text-white">{conv.name || formatPhone(conv.phone)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {conv.name ? `${formatPhone(conv.phone)} · ` : ''}
                    {conv.status === 'closed' ? 'Clôturée' : conv.status === 'replied' ? 'Répondue' : 'À répondre'}
                    {conv.assigned_name ? ` · ${conv.assigned_to === actor?.id ? 'attribuée à vous' : `suivie par ${conv.assigned_name}`}` : ' · non attribuée'}
                  </p>
                </div>
                <button type="button" onClick={() => syncHistory(conv.id)} disabled={syncing} className={btn} title="Récupérer l’historique WhatsApp">
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                </button>
                <a href={`https://wa.me/${conv.phone}`} target="_blank" rel="noopener noreferrer" className={btn} title="Ouvrir dans WhatsApp"><Smartphone className="h-3.5 w-3.5" /></a>
                {mine ? (
                  <button type="button" onClick={() => patchConv({ assign: null })} className={btn} title="Libérer la conversation"><Unlock className="h-3.5 w-3.5" /> Libérer</button>
                ) : (
                  <button type="button" onClick={() => patchConv({ assign: 'me' })} className={`${btn} border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300`}><UserCheck className="h-3.5 w-3.5" /> M’attribuer</button>
                )}
                {conv.status === 'closed' ? (
                  <button type="button" onClick={() => patchConv({ status: 'open' })} className={btn}><RefreshCw className="h-3.5 w-3.5" /> Rouvrir</button>
                ) : (
                  <button type="button" onClick={() => patchConv({ status: 'closed' })} className={btn}><Lock className="h-3.5 w-3.5" /> Clôturer</button>
                )}
                <button type="button" onClick={() => setPanel(panel === 'note' ? null : 'note')} className={`${btn} ${conv.note ? 'border-amber-300 text-amber-700' : ''}`} title="Note interne"><FileText className="h-3.5 w-3.5" /> Note</button>
              </div>
              {panel === 'note' && (
                <div className="border-b border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => noteDraft !== (conv.note || '') && patchConv({ note: noteDraft })} rows={2} placeholder="Note interne (jamais envoyée au client) : besoin, budget, relance prévue…" className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-slate-900" />
                </div>
              )}

              {/* Messages */}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#efeae2] px-3 py-4 dark:bg-slate-900/60">
                {thread?.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                    <div className={`min-w-0 max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.from_me ? 'rounded-br-sm bg-[#d9fdd3] text-slate-900 dark:bg-emerald-800 dark:text-white' : 'rounded-bl-sm bg-white text-slate-900 dark:bg-slate-700 dark:text-white'}`}>
                      {m.media_kind === 'image' && m.media_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a href={m.media_url} target="_blank" rel="noopener noreferrer"><img src={m.media_url} alt="" className="mb-1 max-h-64 rounded-lg object-cover" loading="lazy" /></a>
                      )}
                      {m.media_kind === 'video' && m.media_url && <video src={m.media_url} controls preload="metadata" className="mb-1 max-h-64 rounded-lg" />}
                      {m.media_kind === 'audio' && m.media_url && <audio src={m.media_url} controls preload="none" className="mb-1 max-w-full" />}
                      {(m.media_kind === 'document' || m.media_kind === 'sticker') && m.media_url && (
                        <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-black/5 px-2 py-1.5 text-xs font-semibold underline"><Paperclip className="h-3.5 w-3.5" /> {m.filename || (m.media_kind === 'sticker' ? 'Sticker' : 'Fichier')}</a>
                      )}
                      {(() => {
                        const url = m.type === 'link_preview' && m.media_url ? m.media_url : firstUrl(m.text);
                        return url ? <LinkPreviewCard url={url} fallbackTitle={m.type === 'link_preview' ? m.filename : null} fetcher={api} /> : null;
                      })()}
                      {m.text && <MessageText text={m.text} mine={m.from_me} />}
                      <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${m.from_me ? 'text-emerald-800/70 dark:text-emerald-100/70' : 'text-slate-400'}`}>
                        {m.from_me && (m.sender_name ? <span className="font-semibold">{m.sender_name}</span> : <span className="flex items-center gap-0.5"><Smartphone className="h-3 w-3" /> téléphone</span>)}
                        {!m.from_me && m.sender_name && <span className="font-semibold">{m.sender_name}</span>}
                        <span>{new Date(m.sent_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        {m.from_me && <Receipt status={m.status} />}
                      </p>
                    </div>
                  </div>
                ))}
                {thread && thread.messages.length === 0 && <p className="text-center text-xs text-slate-500">Aucun message enregistré.</p>}
                <div ref={endRef} />
              </div>

              {/* Panneaux outils */}
              {panel === 'quick' && (
                <div className="max-h-64 overflow-y-auto border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex flex-wrap gap-2">
                      {quick.map((r) => (
                        <button key={r.id} type="button" onClick={() => insertQuick(r)} title={r.text} className="max-w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left text-xs dark:border-slate-600 dark:bg-slate-800">
                          <span className="block font-bold text-slate-900 dark:text-white">⚡ {r.label}</span>
                          <span className="block max-w-[16rem] truncate text-slate-500">{r.text.replace(/\s+/g, ' ')}</span>
                        </button>
                      ))}
                      {actor?.role === 'admin' && <button type="button" onClick={() => setQuickEditor(true)} className={btn}>Gérer les phrases</button>}
                    </div>
                </div>
              )}
              {panel === 'media' && (
                <div className="max-h-72 overflow-y-auto border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <input value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} placeholder="Légende (optionnelle, sinon celle du média)" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" />
                    <label className={`${btn} cursor-pointer`}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Envoyer un fichier
                      <input type="file" accept="image/*,video/*,application/pdf" className="hidden" disabled={uploading || sending} onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0])} />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                    {media.map((m) => (
                      <button key={m.id} type="button" disabled={sending} onClick={() => sendMedia(m)} title={`Envoyer : ${m.title}`} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-200 disabled:opacity-50">
                        {m.kind === 'video' ? <video src={m.url} muted preload="metadata" className="h-full w-full object-cover" /> : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt={m.title} className="h-full w-full object-cover" loading="lazy" />
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-left text-[10px] text-white">{m.kind === 'video' ? '🎬 ' : ''}{m.title}</span>
                        <span className="absolute inset-0 hidden items-center justify-center bg-emerald-500/70 text-white group-hover:flex"><Send className="h-5 w-5" /></span>
                      </button>
                    ))}
                    {media.length === 0 && <p className="col-span-full text-xs text-slate-500">Médiathèque vide (à alimenter dans WhatsApp › Diffusion).</p>}
                  </div>
                </div>
              )}

              {/* Composer */}
              <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
                {firstUrl(draft) && (
                  <div className="mb-2 max-w-md text-slate-900 dark:text-white">
                    <LinkPreviewCard url={firstUrl(draft)!} fetcher={api} compact />
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setPanel(panel === 'quick' ? null : 'quick')} className={tool(panel === 'quick')} title="Phrases rapides"><Zap className="h-5 w-5" /></button>
                    <button type="button" onClick={() => setPanel(panel === 'media' ? null : 'media')} className={tool(panel === 'media')} title="Médiathèque et fichiers"><ImageIcon className="h-5 w-5" /></button>
                    <button type="button" onClick={() => setPanel(panel === 'cart' ? null : 'cart')} className={tool(panel === 'cart')} title="Créer un panier depuis un listing"><ShoppingCart className="h-5 w-5" /></button>
                    <span className="hidden sm:flex">
                      <EmojiPicker onPick={(e) => insertAtCursor(textRef.current, draft, e, setDraft)} />
                      <LinkInsertMenu fetcher={api} onPick={(u) => insertAtCursor(textRef.current, draft, u, setDraft)} />
                    </span>
                  </div>
                  <textarea
                    ref={textRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendText();
                      }
                    }}
                    rows={Math.min(6, Math.max(1, draft.split('\n').length))}
                    placeholder="Répondre au client… (Entrée pour envoyer, Maj+Entrée pour une ligne)"
                    className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                  <button type="button" onClick={sendText} disabled={sending || !draft.trim()} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white disabled:opacity-40" aria-label="Envoyer">
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {quickEditor && (
        <QuickRepliesEditor
          initial={quick}
          fetcher={api}
          onClose={() => setQuickEditor(false)}
          onSaved={(items) => {
            setQuick(items);
            setQuickEditor(false);
          }}
        />
      )}

      {/* Panier client : le panneau complet de /admin/whatsapp, pré-rempli avec ce client */}
      {panel === 'cart' && conv && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60" onClick={() => setPanel(null)}>
          <div className="h-full w-full max-w-4xl overflow-y-auto bg-slate-50 p-4 shadow-2xl dark:bg-slate-900 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase text-slate-900 dark:text-white"><Users className="h-5 w-5 text-emerald-500" /> Panier pour {conv.name || formatPhone(conv.phone)}</h2>
              <button type="button" onClick={() => setPanel(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <ClientCartPanel initialName={conv.name || ''} initialPhone={`+${conv.phone}`} />
          </div>
        </div>
      )}
    </div>
  );
}
