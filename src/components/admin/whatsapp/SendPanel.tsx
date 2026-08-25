'use client';

// Panneau « Envoyer » : pilotage de tous les envois depuis la plateforme —
// annonce (texte/image), sondage, diffusion d'offres — vers le sous-groupe choisi.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  Webhook,
  X,
} from 'lucide-react';
import type { CommunityState, DestOption } from './types';

interface PubOffer {
  id: string;
  title: string;
  theme: string | null;
  status: string;
  offer_type?: string | null;
  archived_at?: string | null;
  cover_image_url: string | null;
}
interface PollRow {
  id: string;
  title: string | null;
  results: { name?: string; count?: number }[] | null;
  total_votes: number;
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white';

export default function SendPanel({
  destOptions,
  community,
}: {
  destOptions: DestOption[];
  community: CommunityState | null;
}) {
  const slotOffers = community?.slots.offers || '';
  // Groupe commercial unique : les offres B2B partent aussi vers Packs Clé en Main.
  const slotB2B = community?.slots.b2b || slotOffers;
  const slotSalon = community?.slots.salon || '';

  // Annonce / sondage
  const [mode, setMode] = useState<'message' | 'poll'>('message');
  const [dest, setDest] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annImageUrl, setAnnImageUrl] = useState<string | null>(null);
  const [annUploading, setAnnUploading] = useState(false);
  const [annSending, setAnnSending] = useState(false);
  const [annStatus, setAnnStatus] = useState<string | null>(null);
  const annFileRef = useRef<HTMLInputElement>(null);
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);

  // Diffusion d'offres
  const [offers, setOffers] = useState<PubOffer[]>([]);
  const [offerDest, setOfferDest] = useState<Record<string, string>>({});
  const [bcId, setBcId] = useState<string | null>(null);
  const [bcStatus, setBcStatus] = useState<Record<string, string>>({});

  // Sondages (résultats)
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<string | null>(null);

  // Destination par défaut : sondage → Salon, message → Offres (si configurés).
  useEffect(() => {
    setDest((d) => d || (mode === 'poll' ? slotSalon : slotOffers) || '');
  }, [mode, slotOffers, slotSalon]);

  const loadOffers = useCallback(async () => {
    const res = await fetch('/api/offers');
    const data = await res.json();
    if (Array.isArray(data)) {
      setOffers((data as PubOffer[]).filter((o) => o.status === 'published' && !o.archived_at));
    }
  }, []);

  const loadPolls = useCallback(async () => {
    setPollsLoading(true);
    try {
      const res = await fetch('/api/whapi/polls');
      const data = await res.json();
      if (Array.isArray(data.polls)) setPolls(data.polls);
    } finally {
      setPollsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
    loadPolls();
  }, [loadOffers, loadPolls]);

  const uploadAnnImage = async (file: File) => {
    setAnnUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.urls?.[0]) setAnnImageUrl(data.urls[0]);
      else setAnnStatus(`❌ ${data.error || 'Erreur upload'}`);
    } finally {
      setAnnUploading(false);
    }
  };

  const destLabel = destOptions.find((o) => o.id === dest)?.label || 'Groupe par défaut';

  const sendAnnouncement = async () => {
    if (!annMsg.trim() && !annImageUrl) return;
    setAnnSending(true);
    setAnnStatus(null);
    try {
      const res = await fetch('/api/whapi/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: annMsg, imageUrl: annImageUrl, to: dest || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnnStatus(`❌ ${data.error || 'Échec de l’envoi'}`);
        return;
      }
      setAnnStatus(`✅ Envoyé dans « ${destLabel} »`);
      setAnnMsg('');
      setAnnImageUrl(null);
    } finally {
      setAnnSending(false);
    }
  };

  const sendPoll = async () => {
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollTitle.trim() || options.length < 2) {
      setAnnStatus('❌ Titre + au moins 2 options requis');
      return;
    }
    setAnnSending(true);
    setAnnStatus(null);
    try {
      const res = await fetch('/api/whapi/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pollTitle, options, multiple: pollMultiple, to: dest || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnnStatus(`❌ ${data.error || 'Échec de l’envoi'}`);
        return;
      }
      setAnnStatus(`✅ Sondage envoyé dans « ${destLabel} »`);
      setPollTitle('');
      setPollOptions(['', '']);
      setPollMultiple(false);
    } finally {
      setAnnSending(false);
    }
  };

  const broadcastOffer = async (o: PubOffer) => {
    const to = offerDest[o.id] ?? ((o.offer_type ?? 'b2c') === 'b2b' ? slotB2B : slotOffers);
    setBcId(o.id);
    setBcStatus((s) => ({ ...s, [o.id]: '' }));
    try {
      const res = await fetch(`/api/offers/${o.id}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: window.location.origin, to: to || undefined }),
      });
      const data = await res.json();
      setBcStatus((s) => ({ ...s, [o.id]: res.ok ? '✅ Diffusée' : `❌ ${data.error || 'Échec'}` }));
    } finally {
      setBcId(null);
    }
  };

  const configureWebhook = async () => {
    setWebhookBusy(true);
    setWebhookMsg(null);
    try {
      const res = await fetch('/api/whapi/webhook/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      const data = await res.json();
      setWebhookMsg(res.ok ? '✅ Webhook configuré — les votes seront suivis ici' : `❌ ${data.error || 'Échec'}`);
    } finally {
      setWebhookBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Composeur */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700/50">
            <button
              onClick={() => setMode('message')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === 'message' ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
            >
              <Megaphone className="h-3.5 w-3.5" /> Message
            </button>
            <button
              onClick={() => setMode('poll')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === 'poll' ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Sondage
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Destination
            <select value={dest} onChange={(e) => setDest(e.target.value)} className={`${inputCls} max-w-[260px] py-1.5`}>
              {destOptions.map((o) => (
                <option key={o.id || 'default'} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {mode === 'message' ? (
          <>
            <textarea
              value={annMsg}
              onChange={(e) => setAnnMsg(e.target.value)}
              placeholder="Votre message… (astuce : *gras*, _italique_)"
              rows={3}
              className={`${inputCls} resize-y`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {annImageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={annImageUrl} alt="Image" className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" />
                  <button
                    onClick={() => setAnnImageUrl(null)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white"
                    aria-label="Retirer l’image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => annFileRef.current?.click()}
                  disabled={annUploading}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
                >
                  {annUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Image
                </button>
              )}
              <input
                ref={annFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAnnImage(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={sendAnnouncement}
                disabled={annSending || (!annMsg.trim() && !annImageUrl)}
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/25 disabled:opacity-60"
              >
                {annSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </button>
              {annStatus && <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{annStatus}</span>}
            </div>
          </>
        ) : (
          <>
            <input
              value={pollTitle}
              onChange={(e) => setPollTitle(e.target.value)}
              placeholder="Question du sondage"
              className={inputCls}
            />
            <div className="mt-2 space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                    placeholder={`Option ${i + 1}`}
                    className={inputCls}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      aria-label="Retirer l’option"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 12 && (
              <button onClick={() => setPollOptions((prev) => [...prev, ''])} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Ajouter une option
              </button>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} className="h-4 w-4 rounded" />
                Choix multiples
              </label>
              <button
                onClick={sendPoll}
                disabled={annSending || !pollTitle.trim() || pollOptions.filter((o) => o.trim()).length < 2}
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/25 disabled:opacity-60"
              >
                {annSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                Envoyer le sondage
              </button>
              {annStatus && <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{annStatus}</span>}
            </div>
          </>
        )}
      </div>

      {/* Diffusion d'offres */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <Sparkles className="h-4 w-4" /> Diffuser un listing
        </h2>
        {offers.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">Aucune offre publiée à diffuser.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {offers.map((o) => {
              const isB2B = (o.offer_type ?? 'b2c') === 'b2b';
              const rowDest = offerDest[o.id] ?? (isB2B ? slotB2B : slotOffers);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                    {o.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.cover_image_url} alt={o.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {o.title}
                      {isB2B && <span className="ml-2 rounded bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">B2B</span>}
                    </p>
                    {o.theme && <p className="truncate text-xs text-slate-500">{o.theme}</p>}
                  </div>
                  {bcStatus[o.id] && <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{bcStatus[o.id]}</span>}
                  <select
                    value={rowDest}
                    onChange={(e) => setOfferDest((p) => ({ ...p, [o.id]: e.target.value }))}
                    className={`${inputCls} w-auto max-w-[200px] py-1.5 text-xs`}
                  >
                    {destOptions.map((opt) => (
                      <option key={opt.id || 'default'} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => broadcastOffer(o)}
                    disabled={bcId === o.id}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-60"
                  >
                    {bcId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Diffuser
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Résultats des sondages */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            <BarChart3 className="h-4 w-4" /> Réponses aux sondages
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={loadPolls} disabled={pollsLoading} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300">
              {pollsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Rafraîchir
            </button>
            <button onClick={configureWebhook} disabled={webhookBusy} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300">
              {webhookBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Webhook className="h-3.5 w-3.5" />}
              Webhook
            </button>
          </div>
        </div>
        {webhookMsg && <p className="mb-3 text-xs font-medium text-slate-600 dark:text-slate-300">{webhookMsg}</p>}
        {polls.length === 0 ? (
          <p className="py-2 text-xs text-slate-400">Aucune réponse pour l’instant.</p>
        ) : (
          <ul className="space-y-4">
            {polls.map((poll) => {
              const total = poll.total_votes || 0;
              return (
                <li key={poll.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{poll.title || '(sans titre)'}</p>
                    <span className="flex-shrink-0 text-xs text-slate-400">{total} vote(s)</span>
                  </div>
                  <div className="space-y-1.5">
                    {(poll.results || []).map((r, i) => {
                      const count = r.count || 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span className="truncate">{r.name}</span>
                            <span className="flex-shrink-0 tabular-nums">{count} · {pct}%</span>
                          </div>
                          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-[#25D366]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
