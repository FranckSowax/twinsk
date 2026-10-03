// Types et petits utilitaires partagés par la vue d'ensemble des campagnes
// (DripCampaigns) et l'éditeur d'une campagne (DripPanel).

import type { GroupRow } from './types';
import type { DripChannel } from '@/lib/wa-drip';

type Channels = Record<DripChannel, boolean>;
export interface CampaignSummary {
  slot: number;
  configured: boolean;
  name: string | null;
  enabled: boolean;
  offer_id: string | null;
  offer_title: string | null;
  group_id: string | null;
  products_enabled: boolean;
  product_hours: number[];
  products_channels: Channels;
  announcements_enabled: boolean;
  media_hours: number[];
  announce_channels: Channels;
  announcements_per_slot: number;
  daily: Record<DripChannel, number>;
  last_run_at: string | null;
  media_last_run_at: string | null;
}

export const EXTRA_CHANNELS: { key: Exclude<DripChannel, 'group'>; label: string; short: string }[] = [
  { key: 'status', label: 'Statut WhatsApp', short: 'Statut' },
  { key: 'channel', label: 'Chaîne WhatsApp', short: 'Chaîne' },
  { key: 'facebook', label: 'Page Facebook', short: 'Facebook' },
  { key: 'instagram', label: 'Instagram', short: 'Instagram' },
];

export const hoursLabel = (hours: number[]) => hours.map((h) => `${h}h`).join(', ');

export function groupLabel(groups: GroupRow[], id: string | null): string | null {
  if (!id) return null;
  return groups.find((g) => g.id === id)?.name || `Groupe ${id.split('@')[0].slice(-6)}`;
}

