// Achats sur place › factures fournisseurs — côté serveur : lecture de la
// photo par le modèle (traduction du chinois comprise), enregistrement,
// correction par l'équipe. La partie pure est dans receipts.ts.

import { supabaseAdmin } from '@/lib/supabase/server';
import { chatCompletion, llmCostFcfa, parseJsonLoose, type LlmPart } from '@/lib/llm';
import { FLASH_MODEL } from '@/lib/projects/ai';
import { AchatError } from './data';
import { RECEIPT_STATUS, RECEIPT_SYSTEM_PROMPT, deriveStatus, validateReceiptAnalysis, type BuyingReceipt, type ReceiptPaymentStatus, type ReceiptPhoto } from './receipts';

const now = () => new Date().toISOString();
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const photos = (v: unknown): ReceiptPhoto[] =>
  (Array.isArray(v) ? v : [])
    .map((p) => (p && typeof p === 'object' ? (p as Record<string, unknown>) : null))
    .filter((p): p is Record<string, unknown> => !!p && typeof p.url === 'string' && /^https?:\/\//.test(p.url as string))
    .map((p) => ({ url: p.url as string, caption: str(p.caption, 200) || null, at: typeof p.at === 'string' ? p.at : null }))
    .slice(0, 10);

export async function listReceipts(tripId: string): Promise<BuyingReceipt[]> {
  const { data, error } = await supabaseAdmin.from('buying_receipts').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
  // Migration pas encore appliquée sur ce pays : pas de factures, pas d'erreur.
  if (error) return [];
  return ((data || []) as BuyingReceipt[]).map((r) => ({ ...r, photos: photos(r.photos) }));
}

/** Lecture de la photo par le modèle : fournisseur, montants, acompte ou solde, traduction. */
export async function readReceiptPhotos(urls: string[]): Promise<{ analysis: ReturnType<typeof validateReceiptAnalysis>; costFcfa: number }> {
  const images = urls.filter((u) => /^https?:\/\//.test(u)).slice(0, 4);
  if (!images.length) throw new AchatError('Photo de la facture requise');
  const parts: LlmPart[] = [
    ...images.map((url) => ({ type: 'image' as const, url })),
    { type: 'text' as const, text: `${images.length} photo(s) ci-dessus : la facture ou le reçu du fournisseur, parfois avec sa carte de visite. Lis-les ensemble et réponds par le JSON demandé.` },
  ];
  const r = await chatCompletion({ provider: 'openrouter', model: FLASH_MODEL, system: RECEIPT_SYSTEM_PROMPT, messages: [{ role: 'user', content: parts }], jsonMode: true, maxTokens: 1500, timeoutMs: 120_000, reasoning: 'low' });
  if (!r.ok) throw new AchatError(`Lecture impossible : ${r.error}`, 502);
  const analysis = validateReceiptAnalysis(parseJsonLoose(r.text));
  return { analysis, costFcfa: llmCostFcfa(r) };
}

export interface ReceiptInput {
  item_id?: unknown;
  photos?: unknown;
  supplier_name?: unknown;
  supplier_name_zh?: unknown;
  supplier_address?: unknown;
  supplier_address_zh?: unknown;
  supplier_contact?: unknown;
  currency?: unknown;
  total_amount?: unknown;
  paid_amount?: unknown;
  balance_amount?: unknown;
  payment_status?: unknown;
  issued_on?: unknown;
  delivery_note?: unknown;
  items_text?: unknown;
  notes?: unknown;
}

/** Ligne d'achat du voyage (null si l'id ne lui appartient pas). */
async function itemOf(tripId: string, id: unknown): Promise<string | null> {
  const v = typeof id === 'string' ? id : '';
  if (!/^[0-9a-f-]{36}$/i.test(v)) return null;
  const { data } = await supabaseAdmin.from('buying_items').select('id').eq('id', v).eq('trip_id', tripId).maybeSingle();
  return data ? v : null;
}

/**
 * Photo de facture → facture enregistrée : le modèle la lit et la traduit, le
 * résultat est enregistré tel quel (le client et l'équipe peuvent corriger).
 * Une lecture ratée n'empêche pas d'enregistrer la photo.
 */
export async function addReceipt(tripId: string, input: ReceiptInput, by: 'client' | 'team'): Promise<BuyingReceipt> {
  const pics = photos(input.photos);
  if (!pics.length) throw new AchatError('Photographiez la facture pour l’enregistrer');
  let read: Awaited<ReturnType<typeof readReceiptPhotos>>['analysis'] = null;
  try {
    ({ analysis: read } = await readReceiptPhotos(pics.map((p) => p.url)));
  } catch (e) {
    console.error('[achats] lecture de facture', e);
  }
  const total = num(input.total_amount) ?? read?.total_amount ?? null;
  const paid = num(input.paid_amount) ?? read?.paid_amount ?? null;
  const asked = String(input.payment_status || '');
  const status: ReceiptPaymentStatus = RECEIPT_STATUS.some((s) => s.value === asked) ? (asked as ReceiptPaymentStatus) : (read?.payment_status ?? deriveStatus(total, paid));
  const row = {
    trip_id: tripId,
    item_id: await itemOf(tripId, input.item_id),
    photos: pics,
    supplier_name: str(input.supplier_name, 160) || read?.supplier_name || null,
    supplier_name_zh: read?.supplier_name_zh || null,
    supplier_address: str(input.supplier_address, 300) || read?.supplier_address || null,
    supplier_address_zh: read?.supplier_address_zh || null,
    supplier_contact: str(input.supplier_contact, 160) || read?.supplier_contact || null,
    currency: (str(input.currency, 6) || read?.currency || 'CNY').toUpperCase(),
    total_amount: total,
    paid_amount: paid,
    balance_amount: num(input.balance_amount) ?? read?.balance_amount ?? null,
    payment_status: status,
    issued_on: date(input.issued_on) ?? read?.issued_on ?? null,
    delivery_note: text(input.delivery_note, 200) || read?.delivery_note || null,
    items_text: text(input.items_text, 2000) || read?.items_text || null,
    notes: text(input.notes, 1000) || read?.notes || null,
    raw_text: read?.raw_text || null,
    analysis: read ?? null,
    created_by: by,
  };
  const { data, error } = await supabaseAdmin.from('buying_receipts').insert(row).select('*').single();
  if (error || !data) throw new AchatError(error?.message || 'Facture', 500);
  await supabaseAdmin.from('buying_trips').update({ updated_at: now() }).eq('id', tripId);
  return { ...(data as BuyingReceipt), photos: pics };
}

/** Correction d'une facture (client sur place ou équipe) : seuls les champs envoyés changent. */
export async function updateReceipt(tripId: string, id: string, input: ReceiptInput): Promise<BuyingReceipt> {
  const row: Record<string, unknown> = { updated_at: now() };
  if (input.item_id !== undefined) row.item_id = await itemOf(tripId, input.item_id);
  if (input.photos !== undefined) row.photos = photos(input.photos);
  if (input.supplier_name !== undefined) row.supplier_name = str(input.supplier_name, 160) || null;
  if (input.supplier_address !== undefined) row.supplier_address = str(input.supplier_address, 300) || null;
  if (input.supplier_contact !== undefined) row.supplier_contact = str(input.supplier_contact, 160) || null;
  if (input.currency !== undefined) row.currency = (str(input.currency, 6) || 'CNY').toUpperCase();
  if (input.total_amount !== undefined) row.total_amount = num(input.total_amount);
  if (input.paid_amount !== undefined) row.paid_amount = num(input.paid_amount);
  if (input.balance_amount !== undefined) row.balance_amount = num(input.balance_amount);
  if (input.issued_on !== undefined) row.issued_on = date(input.issued_on);
  if (input.delivery_note !== undefined) row.delivery_note = text(input.delivery_note, 200) || null;
  if (input.items_text !== undefined) row.items_text = text(input.items_text, 2000) || null;
  if (input.notes !== undefined) row.notes = text(input.notes, 1000) || null;
  if (input.payment_status !== undefined) {
    const asked = String(input.payment_status);
    if (!RECEIPT_STATUS.some((s) => s.value === asked)) throw new AchatError('Statut de paiement inconnu');
    row.payment_status = asked;
  }
  const { data, error } = await supabaseAdmin.from('buying_receipts').update(row).eq('id', id).eq('trip_id', tripId).select('*').single();
  if (error || !data) throw new AchatError(error?.message || 'Facture introuvable', error ? 500 : 404);
  return { ...(data as BuyingReceipt), photos: photos((data as BuyingReceipt).photos) };
}

export async function deleteReceipt(tripId: string, id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('buying_receipts').delete().eq('id', id).eq('trip_id', tripId);
  if (error) throw new AchatError(error.message, 500);
}
