'use client';

// Onglet « Diffusion » : une campagne par groupe WhatsApp.
// Vue d'ensemble = une carte par groupe (catalogue, produits, annonces, options
// statut / chaîne / Facebook / Instagram) + le cumul quotidien par canal ;
// un clic ouvre la campagne dans l'éditeur (DripPanel).

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Megaphone, Package, Pause, Play, Plus, Users } from 'lucide-react';
import DripPanel from './DripPanel';
import type { GroupRow } from './types';
import { MAX_DRIP_SLOTS, nextFreeDripSlot, type DripChannel } from '@/lib/wa-drip';
import { EXTRA_CHANNELS, groupLabel, hoursLabel, type CampaignSummary } from './drip-shared';
import { COUNTRY } from '@/config/countries';

function lastRun(c: CampaignSummary): string | null {
  const dates = [c.last_run_at, c.media_last_run_at].filter((x): x is string => !!x).sort();
  const last = dates[dates.length - 1];
  return last
    ? new Date(last).toLocaleString('fr-FR', { timeZone: COUNTRY.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
}

export default function DripCampaigns({ groups: pageGroups }: { groups: GroupRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>(pageGroups);
  const [whatsapp, setWhatsapp] = useState<{ ok: boolean; status: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/whapi/drip?slot=1').catch(() => null);
    const d = r && r.ok ? await r.json() : null;
    if (d && Array.isArray(d.campaigns)) {
      setCampaigns(d.campaigns);
      if (Array.isArray(d.groups) && d.groups.length) setGroups(d.groups);
      setWhatsapp(d.whatsapp || null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const created = campaigns.filter((c) => c.configured);
  const freeSlot = nextFreeDripSlot(created.map((c) => c.slot));

  const toggle = async (c: CampaignSummary) => {
    setBusy(c.slot);
    try {
      await fetch('/api/whapi/drip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: c.slot, enabled: !c.enabled }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (open !== null) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setOpen(null);
            refresh();
          }}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Toutes les campagnes
        </button>
        <DripPanel
          key={open}
          slot={open}
          groups={groups}
          otherCampaigns={created.filter((c) => c.slot !== open)}
          onChanged={refresh}
          onDeleted={() => {
            setOpen(null);
            refresh();
          }}
        />
      </div>
    );
  }

  // Cumul quotidien des campagnes actives : statut, chaîne, Facebook et Instagram sont partagés.
  const totals = created.reduce(
    (acc, c) => {
      for (const k of Object.keys(acc) as DripChannel[]) acc[k] += c.daily?.[k] || 0;
      return acc;
    },
    { group: 0, status: 0, channel: 0, facebook: 0, instagram: 0 } as Record<DripChannel, number>,
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="font-display text-lg font-bold text-slate-900 dark:text-white">Diffusion par groupe</p>
        <p className="mt-1 text-sm text-slate-500">
          Un groupe WhatsApp = un catalogue = une campagne. Chaque campagne publie dans son groupe les <b>produits</b> de son catalogue
          et ses <b>annonces</b> (photos, vidéos), aux heures choisies. Le statut WhatsApp, la chaîne, Facebook et Instagram sont des
          options à cocher dans chaque campagne.
        </p>
        {whatsapp && !whatsapp.ok && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            🚨 WhatsApp déconnecté (statut {whatsapp.status}) : rescanner le QR dans le panel WHAPI. Rien ne part sur les groupes, le statut et la chaîne.
          </p>
        )}
      </div>

      {loaded && created.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800">
          Aucune campagne pour l’instant : créez la première avec « Nouvelle campagne ».
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {created.map((c) => {
          const title = c.name || groupLabel(groups, c.group_id) || c.offer_title || `Campagne ${c.slot}`;
          const extras = EXTRA_CHANNELS.filter((x) => c.products_channels[x.key] || c.announce_channels[x.key]);
          const when = lastRun(c);
          return (
            <div
              key={c.slot}
              className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 dark:bg-slate-800 ${c.enabled ? 'border-[#25D366]/60' : 'border-slate-200 dark:border-slate-700'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setOpen(c.slot)} className="min-w-0 text-left">
                  <span className="block truncate font-display text-base font-bold text-slate-900 hover:underline dark:text-white">{title}</span>
                  <span className="block truncate text-xs text-slate-500">
                    <Users className="mr-1 inline h-3 w-3" />
                    {groupLabel(groups, c.group_id) || 'aucun groupe'}
                    {c.offer_title ? ` · ${c.offer_title}` : ' · aucun catalogue'}
                  </span>
                </button>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}
                >
                  {c.enabled ? 'active' : 'en pause'}
                </span>
              </div>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <Package className={`mt-0.5 h-4 w-4 shrink-0 ${c.products_enabled ? 'text-[#25D366]' : 'text-slate-300'}`} />
                  <span className={c.products_enabled ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
                    {c.products_enabled ? `Produits ${c.product_hours.length}×/jour (${hoursLabel(c.product_hours)})` : 'Produits : désactivés'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Megaphone className={`mt-0.5 h-4 w-4 shrink-0 ${c.announcements_enabled ? 'text-[#25D366]' : 'text-slate-300'}`} />
                  <span className={c.announcements_enabled ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
                    {c.announcements_enabled
                      ? `Annonces ${c.media_hours.length}×/jour (${hoursLabel(c.media_hours)}) · ${c.announcements_per_slot || 0} par envoi`
                      : 'Annonces : désactivées'}
                  </span>
                </li>
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {extras.length === 0 ? (
                  <span className="text-xs text-slate-400">Groupe seulement</span>
                ) : (
                  extras.map((x) => (
                    <span key={x.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      + {x.short}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                <span className="text-xs text-slate-400">{when ? `Dernier envoi ${when}` : 'Jamais publiée'}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    disabled={busy === c.slot}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                  >
                    {c.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {c.enabled ? 'Pause' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(c.slot)}
                    className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
                  >
                    Régler
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => freeSlot !== null && setOpen(freeSlot)}
          disabled={freeSlot === null}
          title={freeSlot === null ? `Maximum ${MAX_DRIP_SLOTS} campagnes : supprimez-en une pour en créer une autre` : 'Créer la campagne d’un groupe'}
          className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-600 hover:border-[#25D366] hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
        >
          <Plus className="h-5 w-5" />
          Nouvelle campagne
          <span className="text-xs font-normal text-slate-400">un groupe + son catalogue</span>
        </button>
      </div>

      {created.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Publications par jour, toutes campagnes actives</p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            {([['group', 'Groupes'], ['status', 'Statut'], ['channel', 'Chaîne'], ['facebook', 'Facebook'], ['instagram', 'Instagram']] as const).map(([k, l]) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                <span className="block text-xs text-slate-500">{l}</span>
                <span className="font-display text-lg font-bold text-slate-900 dark:text-white">{totals[k]}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Le statut, la chaîne, Facebook et Instagram reçoivent la somme de toutes les campagnes qui les ont cochés : gardez ces totaux raisonnables.
          </p>
        </div>
      )}
    </div>
  );
}
