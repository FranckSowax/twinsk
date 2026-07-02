'use client';

import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';

interface GroupInfo {
  id: string;
  name: string;
  participantsCount: number;
  adminsCount: number;
  inviteLink: string | null;
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

  useEffect(() => {
    load();
  }, [load]);

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
