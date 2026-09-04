// Liste des groupes WhatsApp avec cache : WHAPI renvoie parfois une liste vide
// (désynchronisation passagère de sa lecture). On mémorise la dernière liste
// non vide dans wa_settings (clé `known_groups`) pour que l'admin ne perde
// jamais ses menus déroulants.

import { supabaseAdmin } from '@/lib/supabase/server';
import { listWhapiGroups, type WhapiGroupSummary } from '@/lib/whapi';

export const KNOWN_GROUPS_KEY = 'known_groups';

export interface GroupsResult {
  groups: WhapiGroupSummary[];
  /** true = liste servie depuis le cache, WHAPI n'a rien renvoyé. */
  stale: boolean;
  error?: string;
}

export async function listGroupsWithCache(): Promise<GroupsResult> {
  const live = await listWhapiGroups();
  if (live.ok && live.groups && live.groups.length > 0) {
    await supabaseAdmin
      .from('wa_settings')
      .upsert({ key: KNOWN_GROUPS_KEY, value: live.groups, updated_at: new Date().toISOString() });
    return { groups: live.groups, stale: false };
  }
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', KNOWN_GROUPS_KEY).maybeSingle();
  const cached = Array.isArray(data?.value) ? (data!.value as WhapiGroupSummary[]) : [];
  return { groups: cached, stale: true, error: live.ok ? undefined : live.error };
}
