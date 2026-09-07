'use client';

// Onglet « Diffusion » : plusieurs campagnes simultanées, une par onglet.
// Chaque campagne (listing + groupe + canaux + rythme + curseur) est isolée :
// verrou horaire et journal séparés, aucune interférence entre elles.

import { useCallback, useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import DripPanel from './DripPanel';
import type { GroupRow } from './types';

interface Summary {
  slot: number;
  enabled: boolean;
  offer_id: string | null;
  offer_title: string | null;
  group_id: string | null;
}

export default function DripCampaigns({ groups }: { groups: GroupRow[] }) {
  const [slot, setSlot] = useState(1);
  const [campaigns, setCampaigns] = useState<Summary[]>([]);

  // Rafraîchi au montage et à chaque `tick` (après un enregistrement dans un onglet).
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    fetch('/api/whapi/drip?slot=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { campaigns?: Summary[] } | null) => {
        if (alive && d && Array.isArray(d.campaigns)) setCampaigns(d.campaigns);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tick]);

  const tabs = campaigns.length ? campaigns : [{ slot: 1, enabled: false, offer_id: null, offer_title: null, group_id: null }];
  const groupName = (id: string | null) => (id ? groups.find((g) => g.id === id)?.name || id.split('@')[0] : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((c) => {
          const active = c.slot === slot;
          const configured = !!c.offer_id;
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
                  {configured ? `${c.offer_title || 'listing'}${c.group_id ? ` → ${groupName(c.group_id)}` : ''}` : 'non configurée — cliquer pour lancer'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <DripPanel key={slot} slot={slot} groups={groups} onChanged={refresh} />
    </div>
  );
}
