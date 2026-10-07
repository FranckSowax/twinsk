// Achats sur place — couche serveur : lecture et écriture des voyages, jours et
// lignes (supabaseAdmin), lien client à jeton, projection client (sans les
// notes internes), notifications best-effort (Telegram équipe, WhatsApp client).

import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { COUNTRY } from '@/config/countries';
import { sendTelegramMessage } from '@/lib/telegram';
import { notifyClient } from '@/lib/agent-actions';
import { canAddItems, canEditList, ITEM_STATUS, type BuyingDay, type BuyingItem, type BuyingTrip, type ItemStatus, type Photo, type TripStatus, TRIP_STATUS } from './logic';

export const achatsEnabled = () => COUNTRY.modules.twinsk;
export class AchatError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
const fail = (error: { message: string } | null, ctx: string): never => {
  throw new AchatError(error?.message || ctx, 500);
};
const now = () => new Date().toISOString();
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const photos = (v: unknown): Photo[] =>
  (Array.isArray(v) ? v : [])
    .map((p) => (p && typeof p === 'object' ? (p as Record<string, unknown>) : null))
    .filter((p): p is Record<string, unknown> => !!p && typeof p.url === 'string' && /^https?:\/\//.test(p.url as string))
    .map((p) => ({ url: p.url as string, caption: str(p.caption, 200) || null, at: typeof p.at === 'string' ? p.at : null }))
    .slice(0, 20);

export interface TripBundle {
  trip: BuyingTrip;
  days: BuyingDay[];
  items: BuyingItem[];
}

// ---- Voyages ----
export async function listTrips(): Promise<(BuyingTrip & { items_count: number; bought_count: number })[]> {
  const { data, error } = await supabaseAdmin.from('buying_trips').select('*, buying_items(status)').order('created_at', { ascending: false });
  if (error) fail(error, 'Voyages');
  return ((data || []) as (BuyingTrip & { buying_items: { status: ItemStatus }[] })[]).map(({ buying_items, ...t }) => ({ ...t, items_count: buying_items.length, bought_count: buying_items.filter((i) => i.status === 'bought' || i.status === 'ordered_online').length }));
}
export async function createTrip(input: { title: string; client_name: string; client_phone: string; cargo_cutoff?: string | null; notes?: string | null }, by: string): Promise<BuyingTrip> {
  const title = str(input.title, 160);
  if (!title) throw new AchatError('Titre requis');
  const token = randomBytes(24).toString('base64url');
  const { data, error } = await supabaseAdmin
    .from('buying_trips')
    .insert({ title, client_name: str(input.client_name, 120), client_phone: str(input.client_phone, 40), cargo_cutoff: date(input.cargo_cutoff), notes: text(input.notes, 4000) || null, token, created_by: by })
    .select('*')
    .single();
  if (error || !data) fail(error, 'Voyage');
  return data as BuyingTrip;
}
export async function getTrip(id: string): Promise<TripBundle | null> {
  const { data: trip } = await supabaseAdmin.from('buying_trips').select('*').eq('id', id).maybeSingle();
  if (!trip) return null;
  return bundle(trip as BuyingTrip);
}
export async function getTripByToken(token: string): Promise<TripBundle | null> {
  if (!token || token.length < 16) return null;
  const { data: trip } = await supabaseAdmin.from('buying_trips').select('*').eq('token', token).maybeSingle();
  if (!trip) return null;
  return bundle(trip as BuyingTrip);
}
async function bundle(trip: BuyingTrip): Promise<TripBundle> {
  const [{ data: days }, { data: items }] = await Promise.all([
    supabaseAdmin.from('buying_days').select('*').eq('trip_id', trip.id).order('position').order('created_at'),
    supabaseAdmin.from('buying_items').select('*').eq('trip_id', trip.id).order('position').order('created_at'),
  ]);
  return { trip, days: (days || []) as BuyingDay[], items: ((items || []) as BuyingItem[]).map((i) => ({ ...i, source_photos: photos(i.source_photos), photos: photos(i.photos) })) };
}
export async function updateTrip(id: string, patch: { title?: unknown; client_name?: unknown; client_phone?: unknown; cargo_cutoff?: unknown; notes?: unknown; status?: unknown }): Promise<void> {
  const row: Record<string, unknown> = { updated_at: now() };
  if (patch.title !== undefined) {
    const t = str(patch.title, 160);
    if (!t) throw new AchatError('Titre requis');
    row.title = t;
  }
  if (patch.client_name !== undefined) row.client_name = str(patch.client_name, 120);
  if (patch.client_phone !== undefined) row.client_phone = str(patch.client_phone, 40);
  if (patch.cargo_cutoff !== undefined) row.cargo_cutoff = date(patch.cargo_cutoff);
  if (patch.notes !== undefined) row.notes = text(patch.notes, 4000) || null;
  if (patch.status !== undefined) {
    if (!TRIP_STATUS.some((s) => s.value === patch.status)) throw new AchatError('Statut inconnu');
    row.status = patch.status;
  }
  const { error } = await supabaseAdmin.from('buying_trips').update(row).eq('id', id);
  if (error) fail(error, 'Voyage');
}
/** Message du client joint à sa liste (jamais les notes internes de l'équipe). */
export async function updateTripClientNotes(id: string, notes: unknown): Promise<void> {
  const { error } = await supabaseAdmin.from('buying_trips').update({ client_notes: text(notes, 4000) || null, updated_at: now() }).eq('id', id);
  if (error) fail(error, 'Voyage');
}
export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('buying_trips').delete().eq('id', id);
  if (error) fail(error, 'Voyage');
}

// ---- Lignes ----
export interface ItemInput {
  label: unknown;
  details?: unknown;
  link?: unknown;
  source_photos?: unknown;
  quantity?: unknown;
  unit?: unknown;
  supplier?: unknown;
  zone?: unknown;
  lead_time_days?: unknown;
  team_note?: unknown;
  day_id?: unknown;
  /** Sous-ligne d'un article composé (suit le jour du parent). */
  parent_id?: unknown;
}
export async function addItems(tripId: string, inputs: ItemInput[], by: 'client' | 'team'): Promise<BuyingItem[]> {
  const { data: last } = await supabaseAdmin.from('buying_items').select('position').eq('trip_id', tripId).order('position', { ascending: false }).limit(1).maybeSingle();
  let position = (last?.position ?? -1) + 1;
  // Parents valides (du voyage, de premier niveau) : une sous-ligne suit le jour de son parent.
  const parentIds = Array.from(new Set(inputs.map((i) => i.parent_id).filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))));
  const parents = new Map<string, { day_id: string | null }>();
  if (parentIds.length) {
    const { data } = await supabaseAdmin.from('buying_items').select('id, day_id').eq('trip_id', tripId).is('parent_id', null).in('id', parentIds);
    for (const p of (data || []) as { id: string; day_id: string | null }[]) parents.set(p.id, { day_id: p.day_id });
  }
  const rows = inputs
    .map((i) => {
      const label = str(i.label, 160);
      const sp = photos(i.source_photos);
      if (!label && !sp.length) return null;
      const row: Record<string, unknown> = { trip_id: tripId, position: position++, label: label || 'Photo à préciser', details: text(i.details, 2000) || null, link: str(i.link, 500) || null, source_photos: sp, quantity: num(i.quantity), unit: str(i.unit, 20) || null, created_by: by };
      if (by === 'team') Object.assign(row, { supplier: str(i.supplier, 160) || null, zone: str(i.zone, 80) || null, lead_time_days: num(i.lead_time_days) == null ? null : Math.round(num(i.lead_time_days)!), team_note: text(i.team_note, 2000) || null, day_id: typeof i.day_id === 'string' && i.day_id ? i.day_id : null });
      const parent = typeof i.parent_id === 'string' ? parents.get(i.parent_id) : undefined;
      if (parent) Object.assign(row, { parent_id: i.parent_id, day_id: parent.day_id });
      return row;
    })
    .filter((r): r is Record<string, unknown> => !!r)
    .slice(0, 200);
  if (!rows.length) throw new AchatError('Aucune ligne à ajouter');
  const { data, error } = await supabaseAdmin.from('buying_items').insert(rows).select('*');
  if (error || !data) fail(error, 'Lignes');
  await supabaseAdmin.from('buying_trips').update({ updated_at: now() }).eq('id', tripId);
  return data as BuyingItem[];
}
export interface ItemPatch extends Partial<ItemInput> {
  status?: unknown;
  price_cny?: unknown;
  qty_bought?: unknown;
  client_note?: unknown;
  photos?: unknown;
}
/** Le client ne touche qu'à ses champs (et à la liste tant qu'elle est ouverte) ; l'équipe à tout. */
export async function updateItem(tripId: string, itemId: string, patch: ItemPatch, by: 'client' | 'team', tripStatus: TripStatus): Promise<BuyingItem> {
  const row: Record<string, unknown> = { updated_at: now() };
  const listOpen = by === 'team' || canAddItems(tripStatus);
  if (patch.label !== undefined && listOpen) {
    const l = str(patch.label, 160);
    if (!l) throw new AchatError('Libellé requis');
    row.label = l;
  }
  if (patch.details !== undefined && listOpen) row.details = text(patch.details, 2000) || null;
  if (patch.link !== undefined && listOpen) row.link = str(patch.link, 500) || null;
  if (patch.source_photos !== undefined && listOpen) row.source_photos = photos(patch.source_photos);
  if (patch.quantity !== undefined && listOpen) row.quantity = num(patch.quantity);
  if (patch.unit !== undefined && listOpen) row.unit = str(patch.unit, 20) || null;
  if (by === 'team') {
    if (patch.supplier !== undefined) row.supplier = str(patch.supplier, 160) || null;
    if (patch.zone !== undefined) row.zone = str(patch.zone, 80) || null;
    if (patch.lead_time_days !== undefined) row.lead_time_days = num(patch.lead_time_days) == null ? null : Math.round(num(patch.lead_time_days)!);
    if (patch.team_note !== undefined) row.team_note = text(patch.team_note, 2000) || null;
    if (patch.day_id !== undefined) {
      row.day_id = typeof patch.day_id === 'string' && patch.day_id ? patch.day_id : null;
      await supabaseAdmin.from('buying_items').update({ day_id: row.day_id, updated_at: now() }).eq('parent_id', itemId).eq('trip_id', tripId);
    }
  }
  if (patch.status !== undefined) {
    if (!ITEM_STATUS.some((s) => s.value === patch.status)) throw new AchatError('Statut inconnu');
    // « Commandé en ligne » ne se pose que par la commande elle-même (online.ts).
    if (patch.status === 'ordered_online') throw new AchatError('Utilisez « Commander en ligne »');
    row.status = patch.status;
    if (patch.status === 'bought') row.bought_at = now();
    else row.bought_at = null;
  }
  if (patch.price_cny !== undefined) row.price_cny = num(patch.price_cny);
  if (patch.qty_bought !== undefined) row.qty_bought = num(patch.qty_bought);
  if (patch.client_note !== undefined) row.client_note = text(patch.client_note, 2000) || null;
  if (patch.photos !== undefined) row.photos = photos(patch.photos);
  const { data, error } = await supabaseAdmin.from('buying_items').update(row).eq('id', itemId).eq('trip_id', tripId).select('*').single();
  if (error || !data) fail(error, 'Ligne');
  return data as BuyingItem;
}
export async function deleteItem(tripId: string, itemId: string, by: 'client' | 'team', tripStatus: TripStatus): Promise<void> {
  if (by === 'client') {
    if (!canAddItems(tripStatus)) throw new AchatError('Ce voyage est clôturé');
    const { data: it } = await supabaseAdmin.from('buying_items').select('status').eq('id', itemId).eq('trip_id', tripId).maybeSingle();
    if (it && !canEditList(tripStatus) && it.status !== 'to_buy') throw new AchatError('Cette ligne a déjà été traitée : marquez-la plutôt « Pas pris »');
  }
  const { error } = await supabaseAdmin.from('buying_items').delete().eq('id', itemId).eq('trip_id', tripId);
  if (error) fail(error, 'Ligne');
}

// ---- Jours de visite ----
export async function addDay(tripId: string, input: { title: unknown; visit_date?: unknown; zone?: unknown; notes?: unknown; item_ids?: unknown }): Promise<BuyingDay> {
  const title = str(input.title, 120);
  if (!title) throw new AchatError('Titre du jour requis (ex. « Jour 1 — Carreaux, mobilier, sanitaire »)');
  const { data: last } = await supabaseAdmin.from('buying_days').select('position').eq('trip_id', tripId).order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin
    .from('buying_days')
    .insert({ trip_id: tripId, position: (last?.position ?? 0) + 1, title, visit_date: date(input.visit_date), zone: str(input.zone, 80) || null, notes: text(input.notes, 2000) || null })
    .select('*')
    .single();
  if (error || !data) fail(error, 'Jour');
  const ids = Array.isArray(input.item_ids) ? (input.item_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (ids.length) await assignItems(tripId, data.id as string, ids);
  return data as BuyingDay;
}
export async function updateDay(tripId: string, dayId: string, patch: { title?: unknown; visit_date?: unknown; zone?: unknown; notes?: unknown; position?: unknown }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = str(patch.title, 120);
    if (!t) throw new AchatError('Titre du jour requis');
    row.title = t;
  }
  if (patch.visit_date !== undefined) row.visit_date = date(patch.visit_date);
  if (patch.zone !== undefined) row.zone = str(patch.zone, 80) || null;
  if (patch.notes !== undefined) row.notes = text(patch.notes, 2000) || null;
  if (patch.position !== undefined && num(patch.position) != null) row.position = Math.round(num(patch.position)!);
  if (!Object.keys(row).length) return;
  const { error } = await supabaseAdmin.from('buying_days').update(row).eq('id', dayId).eq('trip_id', tripId);
  if (error) fail(error, 'Jour');
}
export async function deleteDay(tripId: string, dayId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('buying_days').delete().eq('id', dayId).eq('trip_id', tripId);
  if (error) fail(error, 'Jour');
}
/** Place des lignes dans un jour (null = les retirer de leur jour). */
export async function assignItems(tripId: string, dayId: string | null, itemIds: string[]): Promise<void> {
  const ids = itemIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
  if (!ids.length) return;
  if (dayId) {
    const { data: d } = await supabaseAdmin.from('buying_days').select('id').eq('id', dayId).eq('trip_id', tripId).maybeSingle();
    if (!d) throw new AchatError('Jour introuvable', 404);
  }
  const { error } = await supabaseAdmin.from('buying_items').update({ day_id: dayId, updated_at: now() }).in('id', ids).eq('trip_id', tripId);
  if (error) fail(error, 'Lignes');
  // Les sous-lignes suivent leur parent.
  await supabaseAdmin.from('buying_items').update({ day_id: dayId, updated_at: now() }).in('parent_id', ids).eq('trip_id', tripId);
  await supabaseAdmin.from('buying_trips').update({ updated_at: now() }).eq('id', tripId);
}

/**
 * Article composé → une sous-ligne par photo (chacune avec son prix, sa
 * quantité, son statut). Le parent garde son libellé et ses précisions et
 * devient l'en-tête ; ses photos passent aux sous-lignes.
 */
export async function splitByPhotos(tripId: string, itemId: string, by: 'client' | 'team'): Promise<BuyingItem[]> {
  const { data: parent } = await supabaseAdmin.from('buying_items').select('*').eq('id', itemId).eq('trip_id', tripId).maybeSingle();
  if (!parent) throw new AchatError('Ligne introuvable', 404);
  const p = parent as BuyingItem;
  if (p.parent_id) throw new AchatError('Une sous-ligne ne se découpe pas');
  const existing = await supabaseAdmin.from('buying_items').select('id', { count: 'exact', head: true }).eq('parent_id', itemId);
  const sp = photos(p.source_photos);
  if (sp.length < 1) throw new AchatError('Ajoutez d’abord les photos des modèles sur cet article');
  const start = (existing.count || 0) + 1;
  const created = await addItems(
    tripId,
    sp.map((photo, i) => ({ label: `${p.label} — ${start + i}`, source_photos: [photo], quantity: p.quantity, unit: p.unit, parent_id: p.id })),
    by,
  );
  await supabaseAdmin.from('buying_items').update({ source_photos: [], updated_at: now() }).eq('id', itemId);
  return created;
}

// ---- Projection client : jamais les notes internes ----
export type ClientItem = Omit<BuyingItem, 'team_note'>;
export interface ClientBundle {
  trip: Omit<BuyingTrip, 'notes' | 'token'>;
  days: BuyingDay[];
  items: ClientItem[];
}
export function toClient(b: TripBundle): ClientBundle {
  const { notes: _notes, token: _token, ...trip } = b.trip;
  void _notes;
  void _token;
  return { trip, days: b.days, items: b.items.map(({ team_note: _t, ...i }) => (void _t, i)) };
}

// ---- Notifications (best-effort) ----
export async function notifyListSubmitted(b: TripBundle, origin: string): Promise<void> {
  try {
    await sendTelegramMessage(`🛒 Liste d'achats reçue — ${b.trip.title}\n${b.trip.client_name || 'Client'} · ${b.items.length} ligne(s)\n${origin}/admin/achats/${b.trip.id}`);
  } catch {
    /* best-effort */
  }
}
export async function notifyProgramReady(b: TripBundle, origin: string): Promise<boolean> {
  if (!b.trip.client_phone) return false;
  try {
    const days = b.days.map((d) => `• ${d.title}${d.visit_date ? ` — ${new Date(`${d.visit_date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}`).join('\n');
    await notifyClient(b.trip.client_phone, `🗓️ *${COUNTRY.senderName} — votre programme d'achats est prêt*\n${b.trip.title}\n${days || 'Jours de visite à venir'}\n\nSur place, cochez, notez et photographiez vos achats ici :\n${origin}/achat/${b.trip.token}`);
    return true;
  } catch {
    return false;
  }
}
