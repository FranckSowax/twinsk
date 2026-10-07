'use client';
/* eslint-disable @next/next/no-img-element -- photos des clients et images produits hébergées hors Next, non optimisées */

// Achats sur place — côté client, pensé pour le téléphone sur place.
// 1. Liste : le client colle ses articles (texte, liens), ajoute des photos,
//    précise, puis envoie sa liste à l'équipe.
// 2. Programme : jours de visite définis par l'équipe ; pour chaque article :
//    acheté / pas pris, prix en ¥, quantité, note, photos ; total en ¥ et en
//    devise locale dans une barre fixe ; délai usine → cargo signalé.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Globe, Images, Link2, Loader2, Plus, Send, ShoppingCart, Trash2 } from 'lucide-react';
import { writeStoredOrderId } from '@/lib/offer-cart-session';
import { COUNTRY } from '@/config/countries';
import { formatPrice } from '@/lib/country';
import { canAddItems, canEditList, canOrderOnline, canShop, childrenOf, daySummaries, fmtCny, hasChildren, itemAmount, leadTime, onlineUnitLocal, parseListText, topLevel, totals, tripStatus, type BuyingDay, type BuyingItem, type BuyingTrip, type ItemStatus, type Photo } from '@/lib/achats/logic';
import { Badge, btn, btnPrimary, input, label } from '@/components/projects/shared';

type Item = Omit<BuyingItem, 'team_note'>;
type Act = (a: string, p?: Record<string, unknown>, k?: string) => Promise<false | Record<string, unknown>>;
interface Bundle {
  trip: Omit<BuyingTrip, 'notes' | 'token'>;
  days: BuyingDay[];
  items: Item[];
}
const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '');

/** Jeton du voyage : identifie le client auprès de /api/upload (pas de limite par IP). */
const TokenCtx = createContext('');
const BATCH = 4;
const MAX_EDGE = 1600;

/** Photo de téléphone (3 à 8 Mo) réduite avant envoi : plus rapide sur réseau mobile, jamais plus de 10 Mo. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size <= 2 * 1024 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Envoie TOUTES les photos choisies, par petits lots, et rend compte de l'avancement. */
async function uploadPhotos(files: File[], token: string, onProgress?: (done: number, total: number) => void): Promise<Photo[]> {
  const out: Photo[] = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = await Promise.all(files.slice(i, i + BATCH).map(shrinkImage));
    const fd = new FormData();
    batch.forEach((f) => fd.append('files', f));
    const r = await fetch('/api/upload', { method: 'POST', body: fd, headers: { 'x-achat-token': token } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !Array.isArray(j.urls)) throw new Error(`${j.error || 'Envoi impossible'}${out.length ? ` (${out.length} photo${out.length > 1 ? 's' : ''} déjà envoyée${out.length > 1 ? 's' : ''})` : ''}`);
    out.push(...(j.urls as string[]).map((url) => ({ url, at: new Date().toISOString() })));
    onProgress?.(out.length, files.length);
  }
  return out;
}
function useUpload() {
  const token = useContext(TokenCtx);
  const [progress, setProgress] = useState<string | null>(null);
  const run = async (files: FileList | null, max: number, apply: (photos: Photo[]) => Promise<unknown>) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, max);
    setProgress(`Envoi 0/${list.length}…`);
    try {
      const photos = await uploadPhotos(list, token, (d, t) => setProgress(`Envoi ${d}/${t}…`));
      setProgress('Enregistrement…');
      await apply(photos);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setProgress(null);
    }
  };
  return { progress, run };
}

export default function AchatClient({ token }: { token: string }) {
  const [b, setB] = useState<Bundle | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/achats/public/${token}`);
    const j = await r.json();
    if (!r.ok) setErr(j.error || 'Erreur');
    else setB(j);
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (action: string, payload: Record<string, unknown> = {}, key = action) => {
    setBusy(key);
    setErr('');
    try {
      const r = await fetch(`/api/achats/public/${token}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      await load();
      return j as Record<string, unknown>;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
      return false;
    } finally {
      setBusy(null);
    }
  };
  if (!b) return err ? <p className="text-sm text-red-600">{err}</p> : <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;
  const { trip } = b;
  const s = tripStatus(trip.status);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">{trip.title}</h1>
          {trip.cargo_cutoff && <p className="text-xs text-slate-500">Marchandises attendues au cargo avant le {fmtDate(trip.cargo_cutoff)}</p>}
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</p>}
      <TokenCtx.Provider value={token}>{canEditList(trip.status) ? <ListEditor b={b} act={act} busy={busy} /> : <Program b={b} act={act} busy={busy} />}</TokenCtx.Provider>
    </div>
  );
}

/* ---------- 1. Composer la liste ---------- */
function ListEditor({ b, act, busy }: { b: Bundle; act: Act; busy: string | null }) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState(b.trip.client_notes || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const { progress, run } = useUpload();
  const uploading = progress != null;
  const submitted = b.trip.status === 'submitted';
  const addText = async () => {
    const parsed = parseListText(text);
    if (!parsed.length) return;
    if (await act('items.add', { items: parsed }, 'add')) setText('');
  };
  const addPhotos = async (files: FileList | null) => {
    await run(files, 100, (photos) => act('items.add', { items: photos.map((p, i) => ({ label: `Photo ${b.items.length + i + 1} — à préciser`, source_photos: [p] })) }, 'add'));
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <div className="space-y-4">
      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><p className="font-semibold">Liste envoyée ✓</p><p>L’équipe {COUNTRY.senderName} prépare votre programme de visites. Vous pouvez encore ajouter ou corriger des articles.</p></div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">Dites-nous ce que vous voulez acheter : collez votre liste (un article par ligne), ajoutez des liens ou des photos. L’équipe regroupera vos articles par jour de visite.</p>
      )}
      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <label className={label}>Ajouter des articles</label>
        <textarea className={input} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Carreaux 60×60 blanc x 120\nLavabo double vasque (lien du produit si vous en avez un)\nCanapé d’angle 3 pcs'} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy === 'add' || !text.trim()} onClick={addText} className={`${btnPrimary} w-full sm:w-auto`}>{busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter ces lignes</button>
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={`${btn} w-full sm:w-auto`}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {progress || 'Ajouter des photos'}</button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
        </div>
        <p className="text-xs text-slate-500">Une photo = un article. Plusieurs modèles d’un même article ? Ouvrez l’article, ajoutez-y ses photos, puis « Un article par photo ».</p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Ma liste <span className="text-sm font-normal text-slate-500">({b.items.length})</span></h2>
        {b.items.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Votre liste est vide.</p> : (
          <ul className="space-y-2">{topLevel(b.items as BuyingItem[]).map((it) => <ListRow key={it.id} it={it} items={b.items} trip={b.trip} act={act} busy={busy} />)}</ul>
        )}
      </section>
      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <label className={label}>Un message pour l’équipe (facultatif)</label>
        <textarea className={input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dates de votre venue, budget, priorités…" />
        {!submitted && <button type="button" disabled={busy === 'submit' || b.items.length === 0} onClick={() => act('list.submit', { client_notes: notes }, 'submit')} className={`${btnPrimary} w-full`}>{busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer ma liste à l’équipe</button>}
      </section>
    </div>
  );
}

function ListRow({ it, items, trip, act, busy }: { it: Item; items: Item[]; trip: Bundle['trip']; act: Act; busy: string | null }) {
  const kids = childrenOf(items as BuyingItem[], it.id);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ label: it.label, details: it.details || '', link: it.link || '', quantity: it.quantity == null ? '' : String(it.quantity), unit: it.unit || '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const { progress, run } = useUpload();
  const uploading = progress != null;
  const addPhotos = async (files: FileList | null) => {
    await run(files, 100, (photos) => act('item.update', { id: it.id, source_photos: [...it.source_photos, ...photos] }, `ph.${it.id}`));
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-1">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-white">{it.label}</span>
            <span className="block text-xs text-slate-500">{it.quantity != null ? `${it.quantity} ${it.unit || ''}` : 'quantité à préciser'}{it.link ? ' · lien' : ''}{it.source_photos.length ? ` · ${it.source_photos.length} photo${it.source_photos.length > 1 ? 's' : ''}` : ''}{kids.length ? ` · ${kids.length} modèle${kids.length > 1 ? 's' : ''}` : ''}</span>
          </span>
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button type="button" disabled={busy === `del.${it.id}`} onClick={() => confirm(kids.length ? `Retirer « ${it.label} » et ses ${kids.length} modèles ?` : `Retirer « ${it.label} » de la liste ?`) && act('item.delete', { id: it.id }, `del.${it.id}`)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Retirer de la liste">{busy === `del.${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
      </div>
      {it.source_photos.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto">{it.source_photos.map((p, i) => <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={p.url} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200" /></a>)}</div>}
      <OnlineOffer it={it} trip={trip} act={act} busy={busy} />
      {!it.parent_id && it.source_photos.length > 0 && canAddItems(trip.status) && (
        <button type="button" disabled={busy === `split.${it.id}`} onClick={() => act('item.split', { id: it.id }, `split.${it.id}`)} className={`${btn} mt-2 !min-h-9 !text-xs`}>{busy === `split.${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />} Un article par photo ({it.source_photos.length}) — chacun avec son prix</button>
      )}
      {kids.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3 dark:border-slate-600">{kids.map((k) => <ListRow key={k.id} it={k} items={items} trip={trip} act={act} busy={busy} />)}</ul>
      )}
      {open && (
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 dark:border-slate-700 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={label}>Article</label><input className={input} value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} /></div>
          <div><label className={label}>Quantité</label><input className={input} inputMode="decimal" value={d.quantity} onChange={(e) => setD({ ...d, quantity: e.target.value })} /></div>
          <div><label className={label}>Unité</label><input className={input} value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })} placeholder="pièce, m², carton…" /></div>
          <div className="sm:col-span-2"><label className={label}>Lien du produit (facultatif)</label><input className={input} inputMode="url" value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className={label}>Précisions (couleur, dimensions, modèle…)</label><textarea className={input} rows={2} value={d.details} onChange={(e) => setD({ ...d, details: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="button" disabled={busy === `save.${it.id}` || !d.label.trim()} onClick={async () => { if (await act('item.update', { id: it.id, ...d }, `save.${it.id}`)) setOpen(false); }} className={`${btnPrimary} flex-1`}>{busy === `save.${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer</button>
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={btn}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {progress || 'Photos'}</button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
          </div>
        </div>
      )}
    </li>
  );
}

/* ---------- 2. Sur place : programme et achats ---------- */
function Program({ b, act, busy }: { b: Bundle; act: Act; busy: string | null }) {
  const { trip, days, items } = b;
  const summaries = useMemo(() => daySummaries(days, items as BuyingItem[]), [days, items]);
  const tot = totals(items as BuyingItem[]);
  const editable = canShop(trip.status);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {trip.status === 'done' && <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">Voyage clôturé — récapitulatif de vos achats.</p>}
      {trip.status === 'planned' && <p className="text-sm text-slate-600 dark:text-slate-300">Votre programme est prêt. Sur place, ouvrez chaque article pour noter ce que vous avez acheté, le prix et une photo : le total se calcule tout seul.</p>}
      {trip.status === 'on_site' && <p className="text-sm text-slate-600 dark:text-slate-300">Vous êtes sur place : touchez un article pour noter ce que vous avez acheté, le prix et une photo. Un article en plus ? Ajoutez-le en bas de page, l’équipe le placera dans votre programme.</p>}
      {summaries.map(({ day, items: dayItems, totals: dt }) => (
        <section key={day?.id || 'none'} className="space-y-2">
          <div className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-10 -mx-3 bg-slate-50/95 px-3 py-2 backdrop-blur dark:bg-slate-950/95 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">{day ? day.title : days.length ? 'Autres articles' : 'Ma liste'}</h2>
            <p className="text-xs text-slate-500">{day?.visit_date ? `${fmtDate(day.visit_date)} · ` : ''}{day?.zone ? `${day.zone} · ` : ''}{dt.bought}/{dt.items} acheté{dt.bought > 1 ? 's' : ''}{dt.cny ? ` · ${fmtCny(dt.cny)}` : ''}</p>
            {day?.notes && <p className="mt-1 rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{day.notes}</p>}
          </div>
          <ul className="space-y-2">{dayItems.map((it) => hasChildren(items as BuyingItem[], it.id) ? <GroupRow key={it.id} it={it} items={items} trip={trip} act={act} busy={busy} editable={editable} open={open} setOpen={setOpen} /> : <ShopRow key={it.id} it={it} trip={trip} act={act} busy={busy} editable={editable} open={open === it.id} toggle={() => setOpen(open === it.id ? null : it.id)} />)}</ul>
        </section>
      ))}
      {canAddItems(trip.status) && <QuickAdd b={b} act={act} busy={busy} />}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total de mes achats</p>
            <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{fmtCny(tot.cny)} <span className="text-sm font-semibold text-slate-500">≈ {formatPrice(tot.local)}</span></p>
            {tot.ordered > 0 && <p className="text-xs font-semibold text-sky-700">+ en ligne : {formatPrice(tot.onlineLocal)} <span className="font-normal text-slate-500">({tot.ordered} ligne{tot.ordered > 1 ? 's' : ''}, hors transport)</span></p>}
          </div>
          <div className="text-right text-xs text-slate-500"><p>{tot.bought}/{tot.items} acheté{tot.bought > 1 ? 's' : ''}</p>{tot.unpriced > 0 && <p className="text-amber-700">{tot.unpriced} sans prix</p>}</div>
        </div>
      </div>
    </div>
  );
}

function ShopRow({ it, trip, act, busy, editable, open, toggle }: { it: Item; trip: Bundle['trip']; act: Act; busy: string | null; editable: boolean; open: boolean; toggle: () => void }) {
  const [d, setD] = useState({ price_cny: it.price_cny == null ? '' : String(it.price_cny), qty_bought: it.qty_bought == null ? '' : String(it.qty_bought), client_note: it.client_note || '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const { progress, run } = useUpload();
  const uploading = progress != null;
  const lt = leadTime(it as BuyingItem, trip);
  const amount = itemAmount(it as BuyingItem);
  const setStatus = (status: ItemStatus) => act('item.update', { id: it.id, status, ...(status === 'bought' ? { price_cny: d.price_cny, qty_bought: d.qty_bought, client_note: d.client_note } : {}) }, `st.${it.id}`);
  const save = () => act('item.update', { id: it.id, price_cny: d.price_cny, qty_bought: d.qty_bought, client_note: d.client_note }, `save.${it.id}`);
  const addPhotos = async (files: FileList | null) => {
    await run(files, 50, (photos) => act('item.update', { id: it.id, photos: [...it.photos, ...photos] }, `ph.${it.id}`));
    if (fileRef.current) fileRef.current.value = '';
  };
  const tone = it.status === 'bought' ? 'border-emerald-300 dark:border-emerald-800' : it.status === 'ordered_online' ? 'border-sky-300 dark:border-sky-800' : it.status === 'skipped' ? 'border-slate-200 opacity-70' : 'border-slate-200 dark:border-slate-700';
  return (
    <li className={`rounded-2xl border bg-white p-3 shadow-sm dark:bg-slate-800 ${tone}`}>
      <button type="button" onClick={toggle} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${it.status === 'bought' ? 'border-emerald-600 bg-emerald-600 text-white' : it.status === 'ordered_online' ? 'border-sky-600 bg-sky-600 text-white' : it.status === 'skipped' ? 'border-slate-300 bg-slate-100 text-slate-400' : 'border-slate-300'}`}>{it.status === 'bought' ? <Check className="h-4 w-4" /> : it.status === 'ordered_online' ? <Globe className="h-3.5 w-3.5" /> : it.status === 'skipped' ? '–' : ''}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${it.status === 'skipped' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{it.label}</span>
          <span className="block text-xs text-slate-500">{it.quantity != null ? `${it.quantity} ${it.unit || ''} · ` : ''}{it.supplier || it.zone ? `${[it.supplier, it.zone].filter(Boolean).join(' · ')}` : 'fournisseur à voir sur place'}</span>
          {lt.ready && <span className={`block text-xs ${lt.late ? 'font-semibold text-red-600' : 'text-slate-500'}`}>Livraison usine → cargo vers le {new Date(`${lt.ready}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}{lt.late ? ' — après la date limite, voir avec l’équipe' : ''}</span>}
        </span>
        <span className="shrink-0 text-right">
          {amount != null && <span className="block text-sm font-bold tabular-nums text-slate-900 dark:text-white">{fmtCny(amount)}</span>}
          <ChevronDown className={`ml-auto mt-1 h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {it.link && <a href={it.link} target="_blank" rel="noopener noreferrer" className="mt-1 ml-9 inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"><Link2 className="h-3 w-3" /> Voir le lien</a>}
      <div className="ml-9"><OnlineOffer it={it} trip={trip} act={act} busy={busy} /></div>
      {(it.source_photos.length > 0 || it.photos.length > 0) && <div className="mt-2 ml-9 flex gap-1.5 overflow-x-auto">{[...it.source_photos, ...it.photos].map((p, i) => <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={p.url} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200" /></a>)}</div>}
      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          {it.details && <p className="text-xs text-slate-600 dark:text-slate-300">{it.details}</p>}
          {editable && (
            <div className="grid grid-cols-3 gap-2">
              {[{ v: 'to_buy', l: 'À acheter' }, { v: 'bought', l: 'Acheté' }, { v: 'skipped', l: 'Pas pris' }].map((o) => (
                <button key={o.v} type="button" disabled={busy === `st.${it.id}`} onClick={() => setStatus(o.v as ItemStatus)} aria-pressed={it.status === o.v} className={`min-h-11 rounded-xl border text-sm font-semibold ${it.status === o.v ? (o.v === 'bought' ? 'border-emerald-600 bg-emerald-600 text-white' : o.v === 'skipped' ? 'border-slate-600 bg-slate-600 text-white' : 'border-amber-500 bg-amber-500 text-white') : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'}`}>{o.l}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Prix unitaire (¥)</label><input className={input} inputMode="decimal" value={d.price_cny} onChange={(e) => setD({ ...d, price_cny: e.target.value })} disabled={!editable} placeholder="0" /></div>
            <div><label className={label}>Quantité achetée</label><input className={input} inputMode="decimal" value={d.qty_bought} onChange={(e) => setD({ ...d, qty_bought: e.target.value })} disabled={!editable} placeholder={it.quantity != null ? String(it.quantity) : '1'} /></div>
          </div>
          <div><label className={label}>Note (fournisseur, référence, couleur, délai annoncé…)</label><textarea className={input} rows={2} value={d.client_note} onChange={(e) => setD({ ...d, client_note: e.target.value })} disabled={!editable} /></div>
          {editable && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={busy === `save.${it.id}`} onClick={save} className={`${btnPrimary} w-full sm:w-auto`}>{busy === `save.${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer</button>
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={`${btn} w-full sm:w-auto`}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {progress || 'Prendre une photo'}</button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
              {it.status !== 'ordered_online' && <button type="button" disabled={busy === `del.${it.id}`} onClick={() => confirm(`Retirer « ${it.label} » de votre liste ?`) && act('item.delete', { id: it.id }, `del.${it.id}`)} className={`${btn} w-full !text-red-600 sm:ml-auto sm:w-auto`}>{busy === `del.${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Retirer de ma liste</button>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ---------- Article composé : en-tête + une sous-ligne par modèle ---------- */
function GroupRow({ it, items, trip, act, busy, editable, open, setOpen }: { it: Item; items: Item[]; trip: Bundle['trip']; act: Act; busy: string | null; editable: boolean; open: string | null; setOpen: (id: string | null) => void }) {
  const kids = childrenOf(items as BuyingItem[], it.id);
  const t = totals(kids);
  return (
    <li className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{it.label}</p>
          <p className="text-xs text-slate-500">{kids.length} modèle{kids.length > 1 ? 's' : ''} · {t.bought}/{t.items} acheté{t.bought > 1 ? 's' : ''}{it.supplier || it.zone ? ` · ${[it.supplier, it.zone].filter(Boolean).join(' · ')}` : ''}</p>
          {it.details && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{it.details}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {t.cny > 0 && <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{fmtCny(t.cny)}</span>}
          {editable && <button type="button" disabled={busy === `del.${it.id}`} onClick={() => confirm(`Retirer « ${it.label} » et ses ${kids.length} modèles de votre liste ?`) && act('item.delete', { id: it.id }, `del.${it.id}`)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Retirer l’article et ses modèles"><Trash2 className="h-4 w-4" /></button>}
        </span>
      </div>
      <ul className="mt-2 space-y-2">{kids.map((k) => <ShopRow key={k.id} it={k} trip={trip} act={act} busy={busy} editable={editable} open={open === k.id} toggle={() => setOpen(open === k.id ? null : k.id)} />)}</ul>
    </li>
  );
}

/* ---------- Alternative « Prix en ligne » (fixée par l'équipe) ---------- */
function OnlineOffer({ it, trip, act, busy }: { it: Item; trip: Bundle['trip']; act: Act; busy: string | null }) {
  const [qty, setQty] = useState(String(it.online_qty ?? Math.max(it.quantity ?? 1, it.online_moq ?? 1)));
  if (!it.online_product_id || it.online_price_cny == null) return null;
  const unit = onlineUnitLocal(it) || 0;
  if (it.status === 'ordered_online') {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <span><Globe className="mr-1 inline h-3.5 w-3.5" /> Commandé en ligne : {it.online_qty ?? '?'} × {formatPrice(unit)}</span>
        {it.online_offer_id && it.online_order_id && <a href={`/offer/${it.online_offer_id}/order/${it.online_order_id}`} className="font-semibold underline">Voir ma commande</a>}
      </div>
    );
  }
  if (!canOrderOnline(it, trip.status)) return null;
  const order = async () => {
    const r = await act('item.order_online', { id: it.id, quantity: qty }, `ol.${it.id}`);
    if (r && typeof r.url === 'string') {
      writeStoredOrderId(String(r.offer_id), String(r.order_id)); // le panier suit le client sur le listing
      window.location.href = r.url;
    }
  };
  return (
    <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs dark:border-sky-900 dark:bg-sky-950/30">
      <div className="flex gap-2">
        {it.online_image_url && <img src={it.online_image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sky-900 dark:text-sky-100"><Globe className="mr-1 inline h-3.5 w-3.5" /> Aussi disponible en ligne</p>
          <p className="line-clamp-2 text-slate-700 dark:text-slate-200">{it.online_title}</p>
          <p className="text-slate-700 dark:text-slate-200"><strong className="tabular-nums">{formatPrice(unit)}</strong> / unité, hors transport{it.online_moq ? ` · minimum ${it.online_moq}` : ''}{it.online_note ? ` · ${it.online_note}` : ''}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input className={`${input} !w-20 !py-1.5 !text-xs`} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantité" />
        <button type="button" disabled={busy === `ol.${it.id}`} onClick={order} className={`${btnPrimary} !min-h-9 flex-1 !text-xs sm:flex-none`}>{busy === `ol.${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} Commander en ligne</button>
      </div>
    </div>
  );
}

/* ---------- Sur place : ajouter un article oublié (texte ou photos) ---------- */
function QuickAdd({ b, act, busy }: { b: Bundle; act: Act; busy: string | null }) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { progress, run } = useUpload();
  const uploading = progress != null;
  const addText = async () => {
    const parsed = parseListText(text);
    if (!parsed.length) return;
    if (await act('items.add', { items: parsed }, 'add')) setText('');
  };
  const addPhotos = async (files: FileList | null) => {
    await run(files, 100, (photos) => act('items.add', { items: photos.map((p, i) => ({ label: `Photo ${b.items.length + i + 1} — à préciser`, source_photos: [p] })) }, 'add'));
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <section className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Ajouter un article à ma liste</h2>
      <textarea className={input} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Un article par ligne, avec la quantité si vous la connaissez" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy === 'add' || !text.trim()} onClick={addText} className={`${btnPrimary} w-full sm:w-auto`}>{busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</button>
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={`${btn} w-full sm:w-auto`}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {progress || 'Ajouter des photos'}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
      </div>
    </section>
  );
}
