// Types partagés des panneaux de l'onglet WhatsApp (communauté + envois).

export interface SubgroupRow {
  id: string;
  title: string;
  inviteCode: string | null;
}

export interface CommunityState {
  configured: boolean;
  announce: SubgroupRow | null;
  subgroups: SubgroupRow[];
  slots: Partial<Record<'offers' | 'b2b' | 'salon', string>>;
  communities?: { id: string; name: string; participantsCount: number }[];
  whapiError?: string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  participantsCount: number;
}

/** Option de destination d'envoi (slot structurel ou groupe libre). */
export interface DestOption {
  id: string; // '' = groupe par défaut (env WHAPI_GROUP_ID)
  label: string;
}

/** Construit la liste des destinations : slots configurés d'abord, puis groupes. */
export function buildDestOptions(community: CommunityState | null, groups: GroupRow[]): DestOption[] {
  const opts: DestOption[] = [];
  const seen = new Set<string>();
  if (community?.configured) {
    if (community.announce) {
      opts.push({ id: community.announce.id, label: '📣 Annonces (toute la communauté)' });
      seen.add(community.announce.id);
    }
    const slotLabels: Record<string, string> = {
      offers: '🛍️ Les Offres Oh My',
      b2b: '🧰 Packs Clé en Main Oh My',
      salon: '💬 Le Salon Oh My',
    };
    for (const [key, gid] of Object.entries(community.slots)) {
      if (gid && !seen.has(gid)) {
        opts.push({ id: gid, label: slotLabels[key] || key });
        seen.add(gid);
      }
    }
  }
  opts.push({ id: '', label: 'Groupe par défaut (historique)' });
  for (const g of groups) {
    if (!seen.has(g.id)) {
      opts.push({ id: g.id, label: `${g.name} (${g.participantsCount})` });
      seen.add(g.id);
    }
  }
  return opts;
}
