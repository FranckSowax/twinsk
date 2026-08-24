'use client';

// Panneau « Communauté » : liaison de la communauté Oh My Group, création/liaison
// des sous-groupes structurels (🛍️ Offres, 🏢 B2B, 💬 Salon) et gestion des membres.

import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import { COMMUNITY_SLOTS } from '@/lib/playbook';
import type { CommunityState, GroupRow } from './types';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export default function CommunityPanel({
  community,
  groups,
  onChanged,
}: {
  community: CommunityState | null;
  groups: GroupRow[];
  onChanged: () => void;
}) {
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  const [createPhones, setCreatePhones] = useState<Record<string, string>>({});
  const [creatingSlot, setCreatingSlot] = useState<string | null>(null);
  // Membres
  const [memberGroup, setMemberGroup] = useState('');
  const [phones, setPhones] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      window.prompt('Copiez :', text);
    }
  };

  const post = async (body: Record<string, unknown>, busyKey: string) => {
    setBusy(busyKey);
    setMsg(null);
    try {
      const res = await fetch('/api/whapi/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${d.error || 'Échec'}`);
        return false;
      }
      onChanged();
      return true;
    } finally {
      setBusy(null);
    }
  };

  const addMembers = async () => {
    const list = phones.split(/[\s,;\n]+/).map((p) => p.trim()).filter(Boolean);
    if (!list.length || !memberGroup) return;
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch('/api/whapi/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: list, id: memberGroup }),
      });
      const d = await res.json();
      if (!res.ok) {
        setAddMsg(`❌ ${d.error || 'Échec de l’ajout'}`);
        return;
      }
      setAddMsg(
        `✅ ${d.attempted} numéro(s) soumis en ${d.batches} lot(s)` +
          (d.skipped > 0 ? ` — ${d.skipped} ignoré(s) (plafond 20 : préférez le lien d'invitation)` : ''),
      );
      setPhones('');
    } finally {
      setAdding(false);
    }
  };

  if (!community) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Connexion à WHAPI…
      </div>
    );
  }

  // ---------- Pas encore liée : sélection de la communauté ----------
  if (!community.configured) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Lier la communauté Oh My Group
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            Sélectionnez la communauté WhatsApp créée depuis votre téléphone. L’app y créera
            ensuite les sous-groupes du playbook et pilotera tous les envois.
          </p>
          {community.whapiError && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {community.whapiError}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedCommunity} onChange={(e) => setSelectedCommunity(e.target.value)} className={`${inputCls} max-w-sm flex-1`}>
              <option value="">— choisir la communauté —</option>
              {(community.communities || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.participantsCount} membres)</option>
              ))}
            </select>
            <button
              onClick={() => post({ community_id: selectedCommunity }, 'link')}
              disabled={!selectedCommunity || busy === 'link'}
              className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Lier
            </button>
          </div>
          {msg && <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">{msg}</p>}
        </div>
      </div>
    );
  }

  // ---------- Liée : slots structurels ----------
  const linkedIds = new Set(Object.values(community.slots));
  const freeSubgroups = community.subgroups.filter((s) => !linkedIds.has(s.id));

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{msg}</p>}

      <div className="space-y-2">
        {COMMUNITY_SLOTS.map((slot) => {
          const gid = slot.auto ? community.announce?.id : community.slots[slot.key as 'offers' | 'b2b' | 'salon'];
          const sub = gid
            ? community.subgroups.find((s) => s.id === gid) ||
              (community.announce?.id === gid ? community.announce : null)
            : null;
          const groupInfo = gid ? groups.find((g) => g.id === gid) : null;
          const inviteLink = sub?.inviteCode ? `https://chat.whatsapp.com/${sub.inviteCode}` : null;
          return (
            <div key={slot.key} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl">{slot.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {slot.name}
                    {slot.auto && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">créé par WhatsApp</span>}
                  </p>
                  <p className="text-[11px] text-slate-400">{slot.desc}</p>
                </div>
                {gid ? (
                  <>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <Check className="h-3 w-3" />
                      {sub?.title || groupInfo?.name || 'lié'}
                      {groupInfo ? ` · ${groupInfo.participantsCount}` : ''}
                    </span>
                    {inviteLink && (
                      <button onClick={() => copyText(inviteLink, slot.key)} title="Copier le lien d'invitation" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                        {copied === slot.key ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                    {!slot.auto && (
                      <button
                        onClick={() => post({ slot: slot.key, group_id: '' }, `unlink-${slot.key}`)}
                        disabled={busy === `unlink-${slot.key}`}
                        className="text-[11px] font-semibold text-slate-400 underline hover:text-red-500"
                      >
                        délier
                      </button>
                    )}
                  </>
                ) : slot.auto ? (
                  <span className="text-xs text-slate-400">détection automatique…</span>
                ) : creatingSlot === slot.key ? (
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <input
                      className={`${inputCls} max-w-[240px]`}
                      placeholder="1ᵉʳ membre : 24107xxxxxxx"
                      value={createPhones[slot.key] || ''}
                      onChange={(e) => setCreatePhones((p) => ({ ...p, [slot.key]: e.target.value }))}
                    />
                    <button
                      onClick={async () => {
                        const ok = await post(
                          { slot: slot.key, create: true, phones: (createPhones[slot.key] || '').split(/[\s,;\n]+/).filter(Boolean) },
                          `create-${slot.key}`,
                        );
                        if (ok) setCreatingSlot(null);
                      }}
                      disabled={busy === `create-${slot.key}` || !(createPhones[slot.key] || '').trim()}
                      className="flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busy === `create-${slot.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Créer
                    </button>
                    <button onClick={() => setCreatingSlot(null)} className="text-[11px] text-slate-400 underline">annuler</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {freeSubgroups.length > 0 && (
                      <>
                        <select
                          value={linkChoice[slot.key] || ''}
                          onChange={(e) => setLinkChoice((p) => ({ ...p, [slot.key]: e.target.value }))}
                          className={`${inputCls} max-w-[200px]`}
                        >
                          <option value="">— lier un sous-groupe —</option>
                          {freeSubgroups.map((s) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => post({ slot: slot.key, group_id: linkChoice[slot.key] }, `link-${slot.key}`)}
                          disabled={!linkChoice[slot.key] || busy === `link-${slot.key}`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                        >
                          {busy === `link-${slot.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lier'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setCreatingSlot(slot.key)}
                      className="flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" /> Créer dans la communauté
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sous-groupes hors slots (départs, etc.) */}
      {freeSubgroups.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">
            {freeSubgroups.length} autre(s) sous-groupe(s) de la communauté
          </summary>
          <ul className="mt-2 space-y-1">
            {freeSubgroups.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
                <span>{s.title}</span>
                {s.inviteCode && (
                  <button onClick={() => copyText(`https://chat.whatsapp.com/${s.inviteCode}`, s.id)} className="text-slate-400 hover:text-emerald-500">
                    {copied === s.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Ajouter des membres */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <UserPlus className="h-4 w-4" /> Ajouter des membres
        </h2>
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>
            Personnes <b>consentantes</b> uniquement. Lots de 5 espacés, plafond <b>20/envoi</b>.
            Au-delà : partagez le <b>lien d’invitation</b> (bouton copier sur chaque groupe).
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <select value={memberGroup} onChange={(e) => setMemberGroup(e.target.value)} className={`${inputCls} max-w-[240px]`}>
            <option value="">— choisir le groupe —</option>
            {community.announce && <option value={community.announce.id}>📣 Annonces</option>}
            {Object.entries(community.slots).map(([key, gid]) => {
              const def = COMMUNITY_SLOTS.find((s) => s.key === key);
              return gid && def ? <option key={gid} value={gid}>{def.emoji} {def.name}</option> : null;
            })}
            {groups.filter((g) => !linkedIds.has(g.id) && g.id !== community.announce?.id).map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.participantsCount})</option>
            ))}
          </select>
          <textarea
            value={phones}
            onChange={(e) => setPhones(e.target.value)}
            placeholder="24177000000, 24166000000"
            rows={2}
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <button
            onClick={addMembers}
            disabled={adding || !phones.trim() || !memberGroup}
            className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Ajouter
          </button>
        </div>
        {addMsg && <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">{addMsg}</p>}
      </div>
    </div>
  );
}
