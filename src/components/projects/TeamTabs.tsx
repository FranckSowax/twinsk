'use client';

// Onglets réservés à l'équipe : usines par lot (alias côté client, identité
// et contacts ici), notation due diligence /25 et statut de sélection, fiche
// anonymisée montrée au client, suivi des échanges (captures d'écran WeChat /
// WhatsApp, e-mails, appels) ; accès client (liens à jeton). Rapport final et
// voyage d'audit : partagés. Messages RFQ : RfqTab.tsx.

import { useState } from 'react';
import { AlertTriangle, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Eye, Link2, Loader2, Mail, MessagesSquare, Plus, ShieldAlert, Sparkles, Trash2, Upload } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { scoreTotal } from '@/lib/projects/logic';
import { CONTACT_CHANNELS, SAMPLE_STATUS, SCORE_CRITERIA, SUPPLIER_STATUS, type ProductPhoto, type ProductSpec, type Scores, type SupplierStatus } from '@/lib/projects/types';
import { FactoryCards } from './FactoryCards';
import { EmailCompose } from './EmailCompose';
import { SupplierExchanges, overdueOf } from './SupplierExchanges';
import { SupplierOffers } from './Offers';
import { ContactBadge, contactsOf } from './ContactTrace';
import { buildSourcingBrief, type SourcingImport } from '@/lib/projects/sourcing';
import { AttachButton, Badge, Empty, Modal, btn, btnPrimary, card, dateShort, dateTime, downloadHref, input, label, type WorkspaceApi } from './shared';

export function SuppliersTab({ p, admin, api }: { p: PublicProject; admin: TeamExtras; api: WorkspaceApi }) {
  const [editing, setEditing] = useState<TeamExtras['suppliers'][number] | 'new' | null>(null);
  const [editingTab, setEditingTab] = useState<SupplierTab>('identity');
  const openFiche = (s: TeamExtras['suppliers'][number], tab: SupplierTab = 'identity') => {
    setEditingTab(tab);
    setEditing(s);
  };
  const [preview, setPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mailTo, setMailTo] = useState<TeamExtras['suppliers'][number] | null>(null);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const contactedCount = admin.suppliers.filter((x) => contactsOf(admin, x.id).length > 0).length;
  const selectedCount = admin.suppliers.filter((x) => x.status === 'selected').length;
  // Relance en retard : seul le dernier échange de chaque usine compte (une réponse plus récente lève la relance).
  const overdue = admin.suppliers.filter((x) => overdueOf(admin, x.id)).length;
  const [copied, setCopied] = useState(false);
  // Besoin de sourcing (entrée du skill) : lots, lignes, quantités, exigences, usines déjà connues.
  const brief = () => JSON.stringify(buildSourcingBrief({ title: p.title, description: p.description, currency: p.currency, phases: p.phases, lines: p.quote.lines.map((l) => ({ lot: l.lot, label: l.label, unit: l.unit, quantity: l.effective_quantity, optional: l.optional })), rfq: admin.rfq, rfqContext: admin.rfq_context, knownSuppliers: admin.suppliers, lots: admin.lots }), null, 2);
  const exportBrief = async () => {
    const text = brief();
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : le téléchargement suffit */
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `besoin-sourcing-${p.title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const bySupplier = (id: string | null) => admin.exchanges.filter((e) => e.supplier_id === id);
  const orphans = admin.exchanges.filter((e) => !e.supplier_id);
  const lots = [...new Set([...admin.lots, ...admin.suppliers.map((s) => s.lot)])].filter((l) => admin.suppliers.some((s) => s.lot === l));
  const watched = admin.suppliers.filter((s) => s.watch_points?.length);
  const contactOf = (s: TeamExtras['suppliers'][number]) => [s.email, s.whatsapp && `WA ${s.whatsapp}`, s.wechat && `WeChat ${s.wechat}`, s.contact].filter(Boolean).join(' · ');
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <ShieldAlert className="mr-1 inline h-4 w-4" /> Tout ce qui figure ici (noms d’usines, contacts, prix d’achat, captures d’échanges) est réservé à l’équipe. Le client voit les alias « Fournisseur A, B… », le classement, le statut et la fiche produit — jamais l’identité.
      </div>

      {watched.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/30 sm:p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100"><AlertTriangle className="h-4 w-4" /> Points à surveiller · {watched.length} usine{watched.length > 1 ? 's' : ''}</p>
          <ul className="mt-2 space-y-1.5">
            {watched.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => openFiche(s)} className="w-full rounded-xl bg-white/70 px-3 py-2 text-left text-sm hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-900">
                  <span className="font-semibold text-slate-900 dark:text-white">{s.real_name || s.alias}</span> <span className="text-xs text-slate-500">({s.alias} · {s.lot})</span>
                  <ul className="mt-0.5 list-disc pl-4 text-xs text-amber-900 dark:text-amber-200">{s.watch_points.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-800/80 dark:text-amber-200/70">À lever avant d’envoyer la demande de prix. Modifiables dans la fiche de l’usine ; jamais visibles du client.</p>
        </div>
      )}

      <div className={card}>
        {/* Repliable : l'en-tête (compteurs, actions) reste visible. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setShowSuppliers((v) => !v)} className="flex min-w-0 flex-1 items-start gap-2 text-left" aria-expanded={showSuppliers}>
            <ChevronDown className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform ${showSuppliers ? '' : '-rotate-90'}`} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
                Usines consultées, classées par lot
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{admin.suppliers.length} usine{admin.suppliers.length > 1 ? 's' : ''} · {lots.length} lot{lots.length > 1 ? 's' : ''}</span>
                {contactedCount > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-sans text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">{contactedCount} contactée{contactedCount > 1 ? 's' : ''}</span>}
                {selectedCount > 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-sans text-[11px] font-semibold text-white">{selectedCount} retenue{selectedCount > 1 ? 's' : ''}</span>}
                {overdue > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-amber-800">{overdue} relance{overdue > 1 ? 's' : ''} en retard</span>}
              </span>
              <span className="block text-xs font-normal text-slate-500">Note due diligence /25 (certifications, adéquation tropicale, installation, prix, transparence). Retenue → le client est prévenu, sous alias.</span>
            </span>
          </button>
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={exportBrief} className={btn} title="Lots, quantités, exigences et usines déjà connues : à donner au skill de sourcing">{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Download className="h-3.5 w-3.5" />} Besoin de sourcing (JSON)</button>
            <button type="button" onClick={() => setImporting(true)} className={btn}><Upload className="h-3.5 w-3.5" /> Importer (JSON)</button>
            <button type="button" onClick={() => setPreview((v) => !v)} className={btn}><Eye className="h-3.5 w-3.5" /> {preview ? 'Masquer l’aperçu client' : 'Aperçu client'}</button>
            <button type="button" onClick={() => { setEditingTab('identity'); setEditing('new'); }} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Usine</button>
          </span>
        </div>
        {showSuppliers && (admin.suppliers.length === 0 ? (
          <Empty>Aucune usine. Ajoutez-en une par lot : l’alias (A, B, C…) est attribué automatiquement.</Empty>
        ) : (
          lots.map((lot) => (
            <div key={lot} className="mt-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{lot}</p>
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="pb-1 text-left font-semibold">#</th><th className="pb-1 text-left font-semibold">Alias</th><th className="pb-1 text-left font-semibold">Usine réelle</th><th className="pb-1 text-left font-semibold">Contact</th><th className="pb-1 text-right font-semibold">/25</th><th className="pb-1 text-left font-semibold">Statut</th><th className="pb-1 text-right font-semibold">Éch.</th><th></th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {admin.suppliers.filter((s) => s.lot === lot).map((s) => (
                    <tr key={s.id} className={s.status === 'rejected' ? 'opacity-50' : ''}>
                      <td className="py-2 pr-2 tabular-nums text-slate-500">{s.rank}</td>
                      <td className="py-2 pr-2"><Badge tone="blue">{s.alias}</Badge></td>
                      <td className="py-2 pr-2 font-medium">
                        {s.watch_points?.length ? <span className="mr-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800" title={s.watch_points.join('\n')}><AlertTriangle className="h-3 w-3" />{s.watch_points.length}</span> : null}
                        {s.real_name || '—'}{s.product_photos?.length ? <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-normal text-slate-500" title="Photos produit visibles du client"><Camera className="h-3 w-3" />{s.product_photos.length}</span> : null}{s.city || s.country ? <span className="text-xs font-normal text-slate-500"> · {[s.city, s.country].filter(Boolean).join(', ')}</span> : null}{s.indicative_price ? <span className="block text-[11px] font-normal text-slate-500">{s.indicative_price}</span> : null}
                        {s.watch_points?.length ? <span className="block max-w-[22rem] truncate text-[11px] font-normal text-amber-700" title={s.watch_points.join('\n')}>⚠ {s.watch_points[0]}</span> : null}
                        <span className="mt-0.5 block"><ContactBadge contacts={contactsOf(admin, s.id)} showNever /></span>
                      </td>
                      <td className="max-w-[14rem] truncate py-2 pr-2 text-xs text-slate-600" title={contactOf(s)}>{contactOf(s) || <span className="text-amber-600">à trouver</span>}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{s.score ?? '—'}</td>
                      <td className="py-2 pr-2">
                        <select className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-900" value={s.status} onChange={(e) => api.act('supplier.status', { id: s.id, status: e.target.value })}>
                          {SUPPLIER_STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </select>
                      </td>
                      <td className="py-2 text-right tabular-nums"><button type="button" onClick={() => openFiche(s, 'exchanges')} className="hover:underline" title="Voir le fil des échanges">{bySupplier(s.id).length}</button>{overdueOf(admin, s.id) && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800" title="Relance en retard">relance</span>}</td>
                      <td className="py-2 text-right"><span className="inline-flex gap-1">{s.email && <button type="button" onClick={() => setMailTo(s)} className={btn} title={admin.email.configured ? `E-mail depuis ${admin.email.from}` : 'Envoi par e-mail non configuré'} aria-label={`E-mail à ${s.real_name || s.alias}`}><Mail className="h-3.5 w-3.5" /></button>}<button type="button" onClick={() => openFiche(s, 'exchanges')} className={btn} title="Fil des échanges avec cette usine : envois, réponses, analyses"><MessagesSquare className="h-3.5 w-3.5" /> Échanges</button><button type="button" onClick={() => openFiche(s)} className={btn}>Fiche</button><button type="button" onClick={() => { if (confirm(`Retirer ${s.alias} (${s.real_name || s.lot}) ?`)) api.act('supplier.delete', { id: s.id }); }} className={btn}><Trash2 className="h-3.5 w-3.5 text-red-500" /></button></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        ))}
      </div>

      {preview && (
        <div className="rounded-2xl border-2 border-dashed border-blue-200 p-3">
          <p className="mb-2 text-xs font-semibold text-blue-800">Ce que voit le client (onglet « Usines ») :</p>
          <FactoryCards suppliers={p.suppliers} lots={admin.lots} />
        </div>
      )}

      {orphans.length > 0 && (
        <div className={`${card} border-amber-300 dark:border-amber-800`}>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Échanges à rattacher à une usine ({orphans.length})</p>
          <p className="text-xs text-slate-500">Enregistrés sans usine : choisissez la bonne fiche pour qu’ils apparaissent dans son onglet « Échanges ».</p>
          <ul className="mt-2 space-y-2">
            {orphans.map((e) => (
              <li key={e.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                <p className="text-[11px] text-slate-500">{dateTime(e.exchanged_at)} · {e.channel}{e.author_name ? ` · ${e.author_name}` : ''}</p>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{e.summary}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select className={`${input} sm:max-w-xs`} defaultValue="" onChange={async (ev) => { if (ev.target.value) await api.act('exchange.assign', { id: e.id, supplier_id: ev.target.value, direction: e.direction === 'note' ? 'in' : e.direction }); }}>
                    <option value="">Rattacher à…</option>
                    {admin.suppliers.map((x) => <option key={x.id} value={x.id}>{x.lot} · {x.real_name || x.alias}</option>)}
                  </select>
                  <button type="button" onClick={() => { if (confirm('Supprimer cet échange ?')) api.act('exchange.delete', { id: e.id }); }} className={btn}><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && <SupplierModal s={editing === 'new' ? null : admin.suppliers.find((x) => x.id === editing.id) || editing} p={p} admin={admin} initialTab={editingTab} api={api} onClose={() => setEditing(null)} />}
      {importing && <ImportModal api={api} onClose={() => setImporting(false)} />}
      {mailTo && <EmailCompose supplier={mailTo} admin={admin} api={api} onClose={() => setMailTo(null)} />}
    </div>
  );
}

/** Photos des produits reçues de l'usine : envoi, légendes, ordre, retrait. Montrées au client dans la fiche anonymisée. */
function SupplierPhotos({ supplierId, initial, api, onCount }: { supplierId: string; initial: ProductPhoto[]; api: WorkspaceApi; onCount: (n: number) => void }) {
  const [photos, setPhotos] = useState<ProductPhoto[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const src = (docId: string) => `${api.baseUrl}/documents/${docId}`;
  const dirty = JSON.stringify(photos) !== saved;
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const r = await fetch(`${api.baseUrl}/suppliers/${supplierId}/photos`, { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Envoi impossible');
      const next = [...photos, ...(d.photos as ProductPhoto[])];
      setPhotos(next);
      setSaved(JSON.stringify(JSON.parse(saved).concat(d.photos)));
      onCount(next.length);
      await api.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.act('supplier.photos', { id: supplierId, photos });
      setSaved(JSON.stringify(photos));
      onCount(photos.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  const move = (i: number, d: -1 | 1) => setPhotos((x) => { const y = [...x]; [y[i], y[i + d]] = [y[i + d], y[i]]; return y; });
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Le client voit ces photos, sous l’alias. Vérifier qu’aucun <b>logo, nom d’usine, filigrane Alibaba, étiquette ou numéro</b> n’apparaît. Les photos sont redressées, réduites à 2000 px et débarrassées de leurs métadonnées (position GPS, appareil).
      </div>
      <label className={`${btnPrimary} cursor-pointer`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Ajouter des photos
        <input type="file" multiple accept="image/*" className="hidden" disabled={busy} onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; upload(f); }} />
      </label>
      {photos.length === 0 ? (
        <Empty>Aucune photo. Ajoutez les photos du produit reçues de l’usine (échantillon, ligne de production, réalisation).</Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.doc_id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(p.doc_id)} alt={p.caption || `Photo ${i + 1}`} className="aspect-[4/3] w-full bg-slate-100 object-cover dark:bg-slate-800" loading="lazy" />
              <div className="space-y-1.5 p-2">
                <input className={`${input} !py-1.5 !text-xs`} placeholder="Légende (ex. échantillon 30 mm)" value={p.caption} onChange={(e) => setPhotos((x) => x.map((y, k) => (k === i ? { ...y, caption: e.target.value } : y)))} />
                <div className="flex items-center justify-between gap-1">
                  <span className="flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className={`${btn} !min-h-8 !px-2`} aria-label="Avancer"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={i === photos.length - 1} onClick={() => move(i, 1)} className={`${btn} !min-h-8 !px-2`} aria-label="Reculer"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </span>
                  <button type="button" onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} className={`${btn} !min-h-8 !px-2`} aria-label="Retirer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      {dirty && <button type="button" disabled={busy} onClick={save} className={btnPrimary}>Enregistrer l’ordre, les légendes et les retraits</button>}
    </div>
  );
}

/** Import du JSON rendu par le skill de sourcing : vérification (aperçu, avertissements) puis enregistrement. */
function ImportModal({ api, onClose }: { api: WorkspaceApi; onClose: () => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<SourcingImport | null>(null);
  const [done, setDone] = useState<{ added: number; completed: number; warnings: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const parse = (): unknown => {
    // Tolère un bloc ```json … ``` collé tel quel depuis la réponse du skill.
    const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    return JSON.parse((m ? m[1] : text).trim());
  };
  const run = async (dry: boolean) => {
    setBusy(true);
    setErr('');
    try {
      const data = parse();
      const r = await api.act('supplier.import', { data, dry_run: dry });
      if (dry) setPreview(r.preview as SourcingImport);
      else setDone(r as unknown as { added: number; completed: number; warnings: string[] });
    } catch (e) {
      setErr(e instanceof SyntaxError ? 'JSON illisible : collez uniquement le bloc JSON rendu par le skill.' : e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Importer des usines (résultat du skill de sourcing)" onClose={onClose} wide>
      {done ? (
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-emerald-700">{done.added} usine(s) ajoutée(s), {done.completed} complétée(s).</p>
          {done.warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-700">{done.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          <p className="text-xs text-slate-500">Les usines déjà présentes n’ont été complétées que sur leurs champs vides ; leur statut reste celui décidé par l’équipe. Rien n’est « retenu » automatiquement.</p>
          <button type="button" onClick={onClose} className={btnPrimary}>Fermer</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Collez le JSON (format <code>twinsk-sourcing-v1</code>) ou choisissez le fichier. « Vérifier » montre ce qui sera importé, sans rien enregistrer.</p>
          <input type="file" accept="application/json,.json,.txt,.md" className="text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setPreview(null); } }} />
          <textarea className={`${input} font-mono text-xs`} rows={10} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder='{ "format": "twinsk-sourcing-v1", "lots": [ … ] }' />
          {preview && (
            <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{preview.suppliers.length} usine(s) : {Object.entries(preview.byLot).map(([l, n]) => `${l} ${n}`).join(' · ')}</p>
              <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                {preview.suppliers.map((x, i) => <li key={i}><b>{x.lot}</b> · {x.real_name}{x.element ? ` — ${x.element}` : ''} · {scoreTotal(x.scores) ?? '—'}/25 · {SUPPLIER_STATUS.find((st) => st.value === x.status)?.label}{x.email || x.whatsapp || x.wechat ? ' · contact ✓' : ' · contact à trouver'}</li>)}
              </ul>
              {preview.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-700">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            </div>
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy || !text.trim()} onClick={() => run(true)} className={btn}>{busy && !preview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Vérifier</button>
            <button type="button" disabled={busy || !preview?.suppliers.length} onClick={() => run(false)} className={btnPrimary}>Importer {preview?.suppliers.length || ''} usine(s)</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

type SupplierForm = {
  lot: string; real_name: string; country: string; city: string; website: string; indicative_price: string;
  contact_name: string; email: string; wechat: string; whatsapp: string; phone: string; contact: string; preferred_channel: string; contact_source: string;
  status: SupplierStatus; scores: Scores;
  description: string; specs: ProductSpec[]; certifications: string; years_experience: string; capacity: string; lead_time: string; moq: string; sample_status: string;
  internal_note: string;
  watch: string;
};
type SupplierTab = 'identity' | 'card' | 'scores' | 'photos' | 'exchanges' | 'offers';
function SupplierModal({ s, p, admin, initialTab = 'identity', api, onClose }: { s: TeamExtras['suppliers'][number] | null; p: PublicProject; admin: TeamExtras; initialTab?: SupplierTab; api: WorkspaceApi; onClose: () => void }) {
  const lots = admin.lots;
  const rfq = admin.rfq;
  const [f, setF] = useState<SupplierForm>({
    lot: s?.lot || lots[0] || '', real_name: s?.real_name || '', country: s?.country || 'Chine', city: s?.city || '', website: s?.website || '', indicative_price: s?.indicative_price || '',
    contact_name: s?.contact_name || '', email: s?.email || '', wechat: s?.wechat || '', whatsapp: s?.whatsapp || '', phone: s?.phone || '', contact: s?.contact || '', preferred_channel: s?.preferred_channel || '', contact_source: s?.contact_source || '',
    status: s?.status || 'candidate', scores: { ...(s?.scores || {}) },
    description: s?.description || '', specs: [...(s?.product_specs || [])], certifications: (s?.certifications || []).join(', '), years_experience: s?.years_experience == null ? '' : String(s.years_experience), capacity: s?.capacity || '', lead_time: s?.lead_time || '', moq: s?.moq || '', sample_status: s?.sample_status || '',
    internal_note: s?.internal_note || '',
    watch: (s?.watch_points || []).join('\n'),
  });
  const [tab, setTab] = useState<SupplierTab>(s ? initialTab : 'identity');
  const exchangeCount = s ? admin.exchanges.filter((e) => e.supplier_id === s.id).length : 0;
  const offerCount = s ? admin.offers.filter((o) => o.supplier_id === s.id && o.status === 'active').length : 0;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState('');
  const total = scoreTotal(f.scores);
  const [photoCount, setPhotoCount] = useState(s?.product_photos?.length || 0);
  const set = (patch: Partial<SupplierForm>) => setF((x) => ({ ...x, ...patch }));
  // Recherche web des contacts par le modèle (:online) : proposition à vérifier, remplit seulement les champs vides.
  const findContacts = async () => {
    setAiBusy(true);
    setErr('');
    try {
      const r = await api.ai('supplier.contacts', { name: f.real_name, website: f.website, city: f.city, product: rfq.find((m) => m.lot === f.lot)?.product_en || f.lot });
      const c = r.result as { contact_name: string | null; email: string | null; wechat: string | null; whatsapp: string | null; phone: string | null; website: string | null; preferred_channel: string; source: string | null; confidence: string; notes: string };
      set({
        contact_name: f.contact_name || c.contact_name || '', email: f.email || c.email || '', wechat: f.wechat || c.wechat || '', whatsapp: f.whatsapp || c.whatsapp || '', phone: f.phone || c.phone || '', website: f.website || c.website || '',
        preferred_channel: f.preferred_channel || c.preferred_channel, contact_source: c.source ? `${c.source} (IA, confiance ${c.confidence})` : f.contact_source,
      });
      const u = r.usage as { model: string; costFcfa: number };
      setAiInfo(`${c.notes || 'Contacts proposés'} — ${u.costFcfa} FCFA — à vérifier avant d’écrire`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Recherche impossible');
    } finally {
      setAiBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.act('supplier.upsert', {
        id: s?.id, lot: f.lot, real_name: f.real_name, country: f.country, city: f.city, website: f.website, indicative_price: f.indicative_price,
        contact_name: f.contact_name, email: f.email, wechat: f.wechat, whatsapp: f.whatsapp, phone: f.phone, contact: f.contact, preferred_channel: f.preferred_channel || null, contact_source: f.contact_source,
        status: f.status, scores: f.scores,
        description: f.description, product_specs: f.specs, certifications: f.certifications.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean), years_experience: f.years_experience === '' ? null : Number(f.years_experience), capacity: f.capacity, lead_time: f.lead_time, moq: f.moq, sample_status: f.sample_status || null,
        internal_note: f.internal_note,
        // Envoyé seulement s'il a changé (le champ n'existe qu'après la migration du 30 sept.).
        ...(f.watch !== (s?.watch_points || []).join('\n') ? { watch_points: f.watch.split('\n').map((x) => x.trim()).filter(Boolean) } : {}),
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  const tabBtn = (k: typeof tab, l: string) => <button type="button" onClick={() => setTab(k)} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === k ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}>{l}</button>;
  return (
    <Modal title={s ? `${s.alias} — ${s.lot}` : 'Nouvelle usine'} onClose={onClose} wide>
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60 [scrollbar-width:none]">{tabBtn('identity', 'Identité & contacts (interne)')}{tabBtn('card', 'Fiche montrée au client')}{tabBtn('scores', `Notation${total != null ? ` ${total}/25` : ''}`)}{s && tabBtn('photos', `Photos produit${photoCount ? ` (${photoCount})` : ''}`)}{s && tabBtn('exchanges', `Échanges${exchangeCount ? ` (${exchangeCount})` : ''}`)}{s && tabBtn('offers', `Prix reçus${offerCount ? ` (${offerCount})` : ''}`)}</div>
      {tab === 'identity' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={label}>Lot</label><input list="lots2" className={input} value={f.lot} onChange={(e) => set({ lot: e.target.value })} /><datalist id="lots2">{lots.map((x) => <option key={x} value={x} />)}</datalist></div>
          <div><label className={label}>Statut</label><select className={input} value={f.status} onChange={(e) => set({ status: e.target.value as SupplierStatus })}>{SUPPLIER_STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={label}>Nom réel de l’usine</label><input className={input} value={f.real_name} onChange={(e) => set({ real_name: e.target.value })} /></div>
          <div><label className={label}>Pays</label><input className={input} value={f.country} onChange={(e) => set({ country: e.target.value })} /></div>
          <div><label className={label}>Ville / province</label><input className={input} value={f.city} onChange={(e) => set({ city: e.target.value })} /></div>
          <div><label className={label}>Site web</label><input className={input} value={f.website} onChange={(e) => set({ website: e.target.value })} placeholder="taishanturf.com" /></div>
          <div><label className={label}>Prix indicatif (interne)</label><input className={input} value={f.indicative_price} onChange={(e) => set({ indicative_price: e.target.value })} placeholder="4,8–5 USD/m² FOB" /></div>
          <div className="sm:col-span-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Contacts (e-mail, WeChat, WhatsApp)</p>
              <button type="button" disabled={aiBusy || f.real_name.trim().length < 3} onClick={findContacts} className={btn} title="Cherche la page contact officielle, Alibaba, Made-in-China">{aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Trouver les contacts (IA)</button>
            </div>
            {aiInfo && <p className="mt-1 text-[11px] text-slate-500">{aiInfo}</p>}
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div><label className={label}>Nom du contact</label><input className={input} value={f.contact_name} onChange={(e) => set({ contact_name: e.target.value })} /></div>
              <div><label className={label}>Canal conseillé</label><select className={input} value={f.preferred_channel} onChange={(e) => set({ preferred_channel: e.target.value })}><option value="">—</option>{CONTACT_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
              <div><label className={label}>E-mail</label><input className={input} value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
              <div><label className={label}>WhatsApp (international)</label><input className={input} value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+86 158 …" /></div>
              <div><label className={label}>WeChat ID</label><input className={input} value={f.wechat} onChange={(e) => set({ wechat: e.target.value })} /></div>
              <div><label className={label}>Téléphone</label><input className={input} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
              <div><label className={label}>Autre (Alibaba, formulaire…)</label><input className={input} value={f.contact} onChange={(e) => set({ contact: e.target.value })} /></div>
              <div><label className={label}>Source du contact</label><input className={input} value={f.contact_source} onChange={(e) => set({ contact_source: e.target.value })} placeholder="Page contact du site, Alibaba…" /></div>
            </div>
          </div>
          <div className="sm:col-span-2"><label className={`${label} text-amber-700`}>Points à surveiller (un par ligne, équipe seulement)</label><textarea className={`${input} border-amber-200 dark:border-amber-900`} rows={3} value={f.watch} onChange={(e) => set({ watch: e.target.value })} placeholder="Ex. entité à confirmer (négociant du Shandong, pas une usine du Henan)" /><p className="mt-1 text-[11px] text-slate-500">Vider un point quand il est levé.</p></div>
          <div className="sm:col-span-2"><label className={label}>Note interne</label><textarea className={input} rows={2} value={f.internal_note} onChange={(e) => set({ internal_note: e.target.value })} /></div>
        </div>
      )}
      {tab === 'card' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-[11px] text-slate-500">Visible du client sous l’alias, sans nom ni ville : décrivez l’usine et le produit sans la rendre identifiable.</p>
          <div className="sm:col-span-2"><label className={label}>Description (usine, expérience, références export)</label><textarea className={input} rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Groupe fondé en 1978, capacité 120 000 m²/jour, installations en Amérique latine…" /></div>
          <div><label className={label}>Années d’expérience</label><input type="number" min={0} className={input} value={f.years_experience} onChange={(e) => set({ years_experience: e.target.value })} /></div>
          <div><label className={label}>Capacité</label><input className={input} value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} placeholder="120 000 m²/jour" /></div>
          <div><label className={label}>Délai de production</label><input className={input} value={f.lead_time} onChange={(e) => set({ lead_time: e.target.value })} placeholder="10–15 jours" /></div>
          <div><label className={label}>Minimum de commande</label><input className={input} value={f.moq} onChange={(e) => set({ moq: e.target.value })} placeholder="1 set" /></div>
          <div><label className={label}>Certifications (séparées par des virgules)</label><input className={input} value={f.certifications} onChange={(e) => set({ certifications: e.target.value })} placeholder="ISO 9001, CE, SGS" /></div>
          <div><label className={label}>Échantillon</label><select className={input} value={f.sample_status} onChange={(e) => set({ sample_status: e.target.value })}><option value="">—</option>{SAMPLE_STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between"><label className={label}>Caractéristiques du produit proposé</label><button type="button" onClick={() => set({ specs: [...f.specs, { label: '', value: '' }] })} className={btn}><Plus className="h-3 w-3" /> Ligne</button></div>
            <div className="space-y-1.5">
              {f.specs.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-1.5">
                  <input className={input} placeholder="Hauteur" value={x.label} onChange={(e) => set({ specs: f.specs.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)) })} />
                  <input className={input} placeholder="30 mm, 16 500 dtex" value={x.value} onChange={(e) => set({ specs: f.specs.map((y, k) => (k === i ? { ...y, value: e.target.value } : y)) })} />
                  <button type="button" onClick={() => set({ specs: f.specs.filter((_, k) => k !== i) })} className={btn} aria-label="Retirer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                </div>
              ))}
              {f.specs.length === 0 && <p className="text-[11px] text-slate-400">Ex. Hauteur : 30 mm · Densité : 44 100 pts/m² · Backing : PU · Garantie : 8 ans</p>}
            </div>
          </div>
        </div>
      )}
      {tab === 'scores' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">Un point par critère, de 0 à 5 : le total /25 classe les usines du lot (visible du client, sans le nom).</p>
          {SCORE_CRITERIA.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-700">
              <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.label}</p><p className="text-[11px] text-slate-500">{c.hint}</p></div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => set({ scores: { ...f.scores, [c.key]: n } })} className={`h-8 w-8 rounded-lg text-sm font-bold ${f.scores[c.key] === n ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'}`}>{n}</button>)}
                {f.scores[c.key] != null && <button type="button" onClick={() => { const sc = { ...f.scores }; delete sc[c.key]; set({ scores: sc }); }} className={btn} title="Effacer">×</button>}
              </div>
            </div>
          ))}
          <p className="text-right text-sm font-bold text-slate-900 dark:text-white">Total : {total ?? '—'} / 25</p>
        </div>
      )}
      {tab === 'photos' && s && <SupplierPhotos supplierId={s.id} initial={s.product_photos || []} api={api} onCount={setPhotoCount} />}
      {tab === 'exchanges' && s && <SupplierExchanges supplier={s} p={p} admin={admin} api={api} />}
      {tab === 'offers' && s && <SupplierOffers supplier={s} p={p} admin={admin} api={api} />}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      {tab !== 'photos' && tab !== 'exchanges' && tab !== 'offers' && <button type="button" disabled={busy || !f.lot.trim()} onClick={save} className={`${btnPrimary} mt-4`}>Enregistrer</button>}
    </Modal>
  );
}

export function AccessTab({ admin, api }: { admin: TeamExtras; api: WorkspaceApi }) {
  const [f, setF] = useState({ person_name: '', role_label: '', expires_at: '' });
  const [created, setCreated] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-display text-base font-bold text-slate-900 dark:text-white">Donner un accès au client</p>
        <p className="mb-3 text-xs text-slate-500">Un lien par personne, sans mot de passe. Il peut être révoqué à tout moment. Le client voit le plan, le journal, les documents partagés et le devis ; jamais les fournisseurs réels, les prix d’achat ni les échanges avec les usines.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={label}>Nom de la personne</label><input className={input} value={f.person_name} onChange={(e) => setF({ ...f, person_name: e.target.value })} /></div>
          <div><label className={label}>Rôle (facultatif)</label><input className={input} placeholder="Directeur, responsable site…" value={f.role_label} onChange={(e) => setF({ ...f, role_label: e.target.value })} /></div>
          <div><label className={label}>Expire le (facultatif)</label><input type="date" className={input} value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></div>
        </div>
        <button type="button" disabled={busy || !f.person_name.trim()} onClick={async () => { setBusy(true); setErr(''); try { const r = await api.act('share.create', { ...f, expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null }); setCreated(`${origin}${r.path}`); setF({ person_name: '', role_label: '', expires_at: '' }); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={`${btnPrimary} mt-3`}><Link2 className="h-3.5 w-3.5" /> Créer le lien</button>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        {created && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <span className="break-all">{created}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(created)} className={btn}><Copy className="h-3.5 w-3.5" /> Copier</button>
          </div>
        )}
      </div>
      <div className={card}>
        <p className="mb-2 font-display text-base font-bold text-slate-900 dark:text-white">Liens existants</p>
        {admin.shares.length === 0 ? (
          <Empty>Aucun lien.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="pb-2 text-left font-semibold">Personne</th><th className="pb-2 text-left font-semibold">Lien</th><th className="pb-2 text-right font-semibold">Vues</th><th className="pb-2 text-left font-semibold">Dernière visite</th><th className="pb-2 text-left font-semibold">État</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {admin.shares.map((s) => {
                const url = `${origin}/projet/${s.token}`;
                const expired = s.expires_at && new Date(s.expires_at) < new Date();
                return (
                  <tr key={s.id} className={s.revoked_at ? 'opacity-50' : ''}>
                    <td className="py-2 pr-2 font-medium">{s.person_name}{s.role_label ? <span className="text-xs text-slate-500"> · {s.role_label}</span> : null}</td>
                    <td className="py-2 pr-2"><button type="button" onClick={() => navigator.clipboard?.writeText(url)} className={btn} title={url}><Copy className="h-3.5 w-3.5" /> Copier</button></td>
                    <td className="py-2 text-right tabular-nums">{s.views}</td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{s.last_seen_at ? dateTime(s.last_seen_at) : '—'}</td>
                    <td className="py-2 pr-2">{s.revoked_at ? <Badge tone="red">Révoqué</Badge> : expired ? <Badge tone="amber">Expiré</Badge> : <Badge tone="emerald">Actif</Badge>}</td>
                    <td className="py-2 text-right">{!s.revoked_at && <button type="button" onClick={() => { if (confirm(`Révoquer le lien de ${s.person_name} ?`)) api.act('share.revoke', { share_id: s.id }); }} className={btn}>Révoquer</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className={card}>
        <p className="mb-2 font-display text-base font-bold text-slate-900 dark:text-white">Journal d’audit</p>
        <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
          {admin.events.slice(0, 150).map((e) => (
            <li key={e.id} className="flex gap-2"><span className="shrink-0 tabular-nums text-slate-400">{dateTime(e.created_at)}</span><span className="shrink-0 font-semibold">{e.actor_name || e.actor}</span><span className="text-slate-500">{e.type}</span><span className="min-w-0 truncate text-slate-700 dark:text-slate-200" title={e.detail || ''}>{e.detail}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ReportTab({ p, api }: { p: PublicProject; api: WorkspaceApi }) {
  const [busy, setBusy] = useState(false);
  const bt = p.business_trip;
  return (
    <div className="space-y-4">
      {p.final_reports.map((r) => {
        const ph = p.phases.find((x) => x.id === r.phase);
        const done = r.checklist.filter((c) => c.done).length;
        return (
          <div key={r.phase} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">Rapport final — {ph?.name || r.phase}</p>
              {r.delivered_at ? <Badge tone="emerald">Remis le {dateShort(r.delivered_at)}</Badge> : <Badge tone="amber">Remis à la réception</Badge>}
            </div>
            <p className="text-xs text-slate-500">{done}/{r.checklist.length} éléments prêts</p>
            <ul className="mt-2 space-y-1.5">
              {r.checklist.map((c) => (
                <li key={c.id}>
                  <label className={`flex min-h-10 items-center gap-2 text-sm sm:min-h-0 ${api.mode === 'team' ? 'cursor-pointer' : ''}`}>
                    <input type="checkbox" checked={c.done} disabled={api.mode !== 'team' || busy} onChange={async (e) => { setBusy(true); try { await api.act('report.set', { phase: r.phase, checklist: r.checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)) }); } finally { setBusy(false); } }} className="h-4 w-4 rounded border-slate-300 text-emerald-600" />
                    <span className={c.done ? 'text-slate-400 line-through' : ''}>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.download_path && (
                <>
                  <a href={r.download_path} target="_blank" rel="noopener noreferrer" className={btnPrimary}><ExternalLink className="h-3.5 w-3.5" /> Ouvrir le rapport</a>
                  <a href={downloadHref(r.download_path)} className={btn}><Download className="h-3.5 w-3.5" /> Télécharger</a>
                </>
              )}
              {api.mode === 'team' && (
                <>
                  <AttachButton api={api} category="reports" label={r.download_path ? 'Remplacer le PDF' : 'Joindre le PDF du rapport'} accept="application/pdf" onAttached={async (a) => { const m = /\/documents\/([0-9a-f-]{36})$/i.exec(a[0]?.url || ''); if (m) await api.act('report.set', { phase: r.phase, file_id: m[1] }); }} />
                  <button type="button" onClick={() => api.act('report.set', { phase: r.phase, delivered: !r.delivered_at })} className={btn}>{r.delivered_at ? 'Marquer non remis' : 'Marquer remis au client'}</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      <div className={card}>
        <p className="font-display text-base font-bold text-slate-900 dark:text-white">{bt.title} (option)</p>
        <p className="text-xs text-slate-500">Auditer les usines retenues, sous alias, avant la signature des accords-cadres.</p>
        <ol className="mt-2 space-y-1 text-sm">{bt.days.map((d) => <li key={d.day}><span className="font-semibold">J{d.day} · {d.city}</span> — {d.program}</li>)}</ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {api.mode === 'client' ? (
            <>
              <button type="button" disabled={!!bt.interested_at} onClick={() => api.act('trip.interested')} className={`${btnPrimary} w-full sm:w-auto`}>{bt.interested_at ? `Intérêt signalé le ${dateShort(bt.interested_at)}` : 'Je suis intéressé'}</button>
              <button type="button" disabled={!!bt.quote_requested_at} onClick={() => api.act('trip.quote')} className={`${btn} w-full sm:w-auto`}>{bt.quote_requested_at ? `Devis demandé le ${dateShort(bt.quote_requested_at)}` : 'Recevoir le devis du voyage'}</button>
            </>
          ) : (
            <p className="text-xs text-slate-600">{bt.interested_at ? `Client intéressé le ${dateShort(bt.interested_at)}.` : 'Le client n’a pas encore signalé d’intérêt.'} {bt.quote_requested_at ? `Devis du voyage demandé le ${dateShort(bt.quote_requested_at)} : chiffrer la ligne « Voyage d’audit » du devis.` : ''}</p>
          )}
        </div>
      </div>
    </div>
  );
}
