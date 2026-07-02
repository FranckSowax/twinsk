'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Users,
  ShieldCheck,
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  Loader2,
  RefreshCw,
  UserPlus,
  AlertTriangle,
  Megaphone,
  Send,
  Upload,
  Sparkles,
  X,
} from 'lucide-react';

interface GroupInfo {
  id: string;
  name: string;
  participantsCount: number;
  adminsCount: number;
  inviteLink: string | null;
}

interface PubOffer {
  id: string;
  title: string;
  theme: string | null;
  status: string;
  cover_image_url: string | null;
}

export default function AdminWhatsappPage() {
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [phones, setPhones] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Annonce libre
  const [annMsg, setAnnMsg] = useState('');
  const [annImageUrl, setAnnImageUrl] = useState<string | null>(null);
  const [annUploading, setAnnUploading] = useState(false);
  const [annSending, setAnnSending] = useState(false);
  const [annStatus, setAnnStatus] = useState<string | null>(null);
  const annFileRef = useRef<HTMLInputElement>(null);

  // Diffuser une offre
  const [offers, setOffers] = useState<PubOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [bcId, setBcId] = useState<string | null>(null);
  const [bcStatus, setBcStatus] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/whapi/group');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de connexion au groupe');
        if (data.groupId) setGroupId(data.groupId);
        setGroup(null);
        return;
      }
      setGroup(data.group);
      setGroupId(data.groupId);
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const res = await fetch('/api/offers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setOffers(
          (data as PubOffer[]).filter((o) => o.status === 'published'),
        );
      }
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadOffers();
  }, [load, loadOffers]);

  const uploadAnnImage = async (file: File) => {
    setAnnUploading(true);
    setAnnStatus(null);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.urls?.[0]) {
        setAnnStatus(`❌ ${data.error || 'Erreur upload'}`);
        return;
      }
      setAnnImageUrl(data.urls[0]);
    } finally {
      setAnnUploading(false);
    }
  };

  const sendAnnouncement = async () => {
    if (!annMsg.trim() && !annImageUrl) return;
    setAnnSending(true);
    setAnnStatus(null);
    try {
      const res = await fetch('/api/whapi/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: annMsg, imageUrl: annImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnnStatus(`❌ ${data.error || 'Échec de l’envoi'}`);
        return;
      }
      setAnnStatus('✅ Annonce envoyée dans le groupe');
      setAnnMsg('');
      setAnnImageUrl(null);
    } catch {
      setAnnStatus('❌ Erreur réseau');
    } finally {
      setAnnSending(false);
    }
  };

  const broadcastOffer = async (id: string) => {
    setBcId(id);
    setBcStatus((s) => ({ ...s, [id]: '' }));
    try {
      const res = await fetch(`/api/offers/${id}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      const data = await res.json();
      setBcStatus((s) => ({
        ...s,
        [id]: res.ok ? '✅ Diffusée' : `❌ ${data.error || 'Échec'}`,
      }));
    } catch {
      setBcStatus((s) => ({ ...s, [id]: '❌ Erreur réseau' }));
    } finally {
      setBcId(null);
    }
  };

  const addParticipants = async () => {
    const list = phones
      .split(/[\s,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!list.length) return;
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch('/api/whapi/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: list }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddMsg(`❌ ${data.error || 'Échec de l’ajout'}`);
        return;
      }
      setAddMsg(`✅ ${list.length} numéro(s) ajouté(s)`);
      setPhones('');
      load();
    } catch {
      setAddMsg('❌ Erreur réseau');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#25D366]">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Groupe WhatsApp
          </h1>
          <p className="text-sm text-slate-500">
            Diffusion des offres et gestion du groupe via WHAPI.
          </p>
        </div>
      </div>

      {/* Statut du groupe */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Statut du groupe
          </h2>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Connexion au groupe…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-semibold">Groupe injoignable</p>
              <p className="mt-0.5 text-xs">{error}</p>
              <p className="mt-1 text-xs text-amber-700/80">
                Groupe : <code className="font-mono">{groupId || '—'}</code>. Vérifiez que
                <code className="mx-1 font-mono">WHAPI_TOKEN</code> est configuré et que le numéro
                connecté est bien membre du groupe.
              </p>
            </div>
          </div>
        ) : group ? (
          <div className="space-y-4">
            <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {group.name}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-700/40">
                <Users className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Participants
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {group.participantsCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-700/40">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Admins
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">{group.adminsCount}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              ID : <code className="font-mono">{group.id}</code>
            </p>

            {/* Lien d'invitation */}
            {group.inviteLink && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Lien d’invitation
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={group.inviteLink}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(group.inviteLink!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Annonce libre */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <Megaphone className="h-4 w-4" />
          Annonce libre
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Message texte + image optionnelle, envoyés directement dans le groupe.
        </p>
        <textarea
          value={annMsg}
          onChange={(e) => setAnnMsg(e.target.value)}
          placeholder="Votre annonce… (astuce : *gras*, _italique_)"
          rows={3}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {annImageUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={annImageUrl}
                alt="Image annonce"
                className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
              />
              <button
                type="button"
                onClick={() => setAnnImageUrl(null)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white"
                aria-label="Retirer l’image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => annFileRef.current?.click()}
              disabled={annUploading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
            >
              {annUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Ajouter une image
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
          <motion.button
            type="button"
            onClick={sendAnnouncement}
            disabled={annSending || (!annMsg.trim() && !annImageUrl)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/25 disabled:opacity-60"
          >
            {annSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer l’annonce
          </motion.button>
          {annStatus && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{annStatus}</span>
          )}
        </div>
      </div>

      {/* Diffuser une offre publiée */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <Sparkles className="h-4 w-4" />
          Diffuser une offre
        </h2>
        {offersLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des offres…
          </div>
        ) : offers.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">
            Aucune offre publiée. Publiez une offre dans « Offres B2C » pour pouvoir la diffuser.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {offers.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                  {o.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.cover_image_url} alt={o.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{o.title}</p>
                  {o.theme && <p className="truncate text-xs text-slate-500">{o.theme}</p>}
                </div>
                {bcStatus[o.id] && (
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{bcStatus[o.id]}</span>
                )}
                <motion.button
                  type="button"
                  onClick={() => broadcastOffer(o.id)}
                  disabled={bcId === o.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-60"
                >
                  {bcId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Diffuser
                </motion.button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ajout de participants */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <UserPlus className="h-4 w-4" />
          Ajouter des participants
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Numéros au format international sans « + » (ex. 24177000000), séparés par un espace, une
          virgule ou un retour à la ligne. N’ajoutez que des personnes consentantes.
        </p>
        <textarea
          value={phones}
          onChange={(e) => setPhones(e.target.value)}
          placeholder="24177000000, 24166000000"
          rows={2}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <motion.button
            type="button"
            onClick={addParticipants}
            disabled={adding || !phones.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/25 disabled:opacity-60"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Ajouter au groupe
          </motion.button>
          {addMsg && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{addMsg}</span>
          )}
        </div>
      </div>
    </div>
  );
}
