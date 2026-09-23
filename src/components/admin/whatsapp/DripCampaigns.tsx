'use client';

// Onglet « Diffusion » : plusieurs campagnes simultanées, une par onglet.
// Chaque campagne (listing + groupe + canaux + rythme + curseur) est isolée :
// verrou horaire et journal séparés, aucune interférence entre elles.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Radio } from 'lucide-react';
import DripPanel from './DripPanel';
import type { GroupRow } from './types';
import { MAX_DRIP_SLOTS, nextFreeDripSlot } from '@/lib/wa-drip';

interface Summary {
  slot: number;
  configured?: boolean;
  mode?: 'media' | 'catalog';
  enabled: boolean;
  offer_id: string | null;
  offer_title: string | null;
  group_id: string | null;
}

export default function DripCampaigns({ groups }: { groups: GroupRow[] }) {
  // Emplacement ouvert ; null tant qu'aucune campagne n'est choisie ou créée.
  const [slot, setSlot] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<Summary[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Rafraîchi au montage et à chaque `tick` (après un enregistrement dans un onglet).
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    fetch('/api/whapi/drip?slot=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { campaigns?: Summary[] } | null) => {
        if (alive && d && Array.isArray(d.campaigns)) {
          setCampaigns(d.campaigns);
          setLoaded(true);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tick]);

  // Seules les campagnes créées ont un onglet ; « Nouvelle campagne » ouvre le premier emplacement libre.
  const created = campaigns.filter((c) => c.configured !== false);
  const freeSlot = nextFreeDripSlot(created.map((c) => c.slot));
  // Campagne ouverte : celle choisie, sinon la première existante.
  const activeSlot = slot ?? created[0]?.slot ?? null;
  const isNew = activeSlot !== null && !created.some((c) => c.slot === activeSlot);
  const tabs = isNew
    ? [...created, { slot: activeSlot as number, mode: 'media' as const, enabled: false, offer_id: null, offer_title: null, group_id: null, configured: false }]
    : created;
  const groupName = (id: string | null) => (id ? groups.find((g) => g.id === id)?.name || id.split('@')[0] : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((c) => {
          const active = c.slot === activeSlot;
          const configured = c.mode === 'media' ? !!c.group_id || c.enabled : !!c.offer_id;
          const modeLabel = c.mode === 'catalog' ? '📦 catalogue' : '🎬 médias';
          return (
            <button
              key={c.slot}
              type="button"
              onClick={() => setSlot(c.slot)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-left text-sm transition ${
                active
                  ? 'border-[#25D366] bg-[#25D366]/10 text-slate-900 dark:text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Radio className={`h-4 w-4 ${c.enabled ? 'text-[#25D366]' : 'text-slate-400'}`} />
              <span>
                <span className="block font-semibold">
                  Campagne {c.slot} {c.enabled ? '🟢' : configured ? '⏸' : ''}
                </span>
                <span className="block text-xs text-slate-500">
                  {modeLabel}
                  {configured
                    ? ` · ${c.mode === 'catalog' ? c.offer_title || 'listing' : c.offer_title || 'médiathèque'}${c.group_id ? ` → ${groupName(c.group_id)}` : ''}`
                    : c.configured === false
                      ? ' · nouvelle — à configurer puis enregistrer'
                      : ' · non configurée'}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => freeSlot !== null && setSlot(freeSlot)}
          disabled={freeSlot === null || isNew}
          title={freeSlot === null ? `Maximum ${MAX_DRIP_SLOTS} campagnes : supprimez-en une pour en créer une autre` : 'Créer une campagne'}
          className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-[#25D366] hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
        >
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </button>
      </div>
      {loaded && activeSlot === null && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800">
          Aucune campagne pour l’instant : cliquez sur « Nouvelle campagne ».
        </p>
      )}
      {activeSlot !== null && (
        <DripPanel
          key={activeSlot}
          slot={activeSlot}
          groups={groups}
          onChanged={refresh}
          onDeleted={() => {
            setSlot(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
