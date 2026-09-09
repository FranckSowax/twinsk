'use client';

// Centre de pilotage WhatsApp — fusion de l'onglet WhatsApp et du Playbook :
//   Communauté : liaison Oh My Group + création des sous-groupes structurels
//   Envoyer    : annonces, sondages, diffusion de listings (destination au choix)
//   Playbook   : rituels de la semaine + récap catalogue du vendredi
//   Départs    : groupes logistiques air/mer + jalons
// Toute la mécanique WHAPI (anti-spam, invitations) vit dans src/lib/whapi.ts.

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpenCheck,
  Home,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Ship, Radio, ShoppingCart, Search } from 'lucide-react';
import CommunityPanel from '@/components/admin/whatsapp/CommunityPanel';
import SendPanel from '@/components/admin/whatsapp/SendPanel';
import PlaybookPanel from '@/components/admin/whatsapp/PlaybookPanel';
import DeparturesPanel from '@/components/admin/whatsapp/DeparturesPanel';
import DripCampaigns from '@/components/admin/whatsapp/DripCampaigns';
import ClientCartPanel from '@/components/admin/whatsapp/ClientCartPanel';
import SalonPanel from '@/components/admin/whatsapp/SalonPanel';
import { buildDestOptions, type CommunityState, type GroupRow } from '@/components/admin/whatsapp/types';

const TABS = [
  { key: 'send', label: 'Envoyer', icon: Send },
  { key: 'community', label: 'Communauté', icon: Home },
  { key: 'playbook', label: 'Playbook', icon: BookOpenCheck },
  { key: 'departures', label: 'Départs', icon: Ship },
  { key: 'drip', label: 'Diffusion', icon: Radio },
  { key: 'cart', label: 'Panier client', icon: ShoppingCart },
  { key: 'salon', label: 'Recherches', icon: Search },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function AdminWhatsappPage() {
  const [tab, setTab] = useState<TabKey>('send');
  const [community, setCommunity] = useState<CommunityState | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, gRes] = await Promise.all([
        fetch('/api/whapi/community'),
        fetch('/api/whapi/groups'),
      ]);
      if (cRes.ok) setCommunity(await cRes.json());
      if (gRes.ok) {
        const d = await gRes.json();
        if (Array.isArray(d.groups)) setGroups(d.groups);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const destOptions = buildDestOptions(community, groups);
  const communityConfigured = !!community?.configured;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#25D366]">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            WhatsApp — Oh My Group
          </h1>
          <p className="text-sm text-slate-500">
            {communityConfigured
              ? 'Communauté liée — pilotez vos sous-groupes et vos envois depuis la plateforme.'
              : 'Liez la communauté (onglet Communauté) pour activer les sous-groupes du playbook.'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          title="Rafraîchir"
          className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {/* Onglets */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-slate-900 text-white dark:bg-[#25D366]'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-[#25D366]/60 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'send' && <SendPanel destOptions={destOptions} community={community} />}
      {tab === 'community' && <CommunityPanel community={community} groups={groups} onChanged={load} />}
      {tab === 'playbook' && <PlaybookPanel destOptions={destOptions} community={community} />}
      {tab === 'departures' && <DeparturesPanel groups={groups} communityConfigured={communityConfigured} />}
      {tab === 'drip' && <DripCampaigns groups={groups} />}
      {tab === 'cart' && <ClientCartPanel />}
      {tab === 'salon' && <SalonPanel groups={groups} />}
    </div>
  );
}
