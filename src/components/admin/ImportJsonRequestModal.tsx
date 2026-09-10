'use client';

// « Nouvelle demande depuis un JSON » : crée une demande de sourcing (client +
// notes) puis y charge un JSON de listing B2B/B2C (format catalogue Twinsk :
// { meta?, categories: [{ title/description, products: [...] }] }) via la
// route bulk-load des demandes. On atterrit ensuite sur la fiche de la demande,
// d'où l'on génère le devis ou la packing list.

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, FileJson, Loader2, Upload, X } from 'lucide-react';

interface Preview { categories: number; products: number; variants: number; title: string | null }

function previewOf(json: string): { preview: Preview | null; error: string | null } {
  const t = json.trim();
  if (!t) return { preview: null, error: null };
  try {
    const parsed = JSON.parse(t) as { meta?: { title?: string; theme?: string }; categories?: { products?: { variants?: unknown[] }[] }[] };
    if (!parsed || !Array.isArray(parsed.categories)) return { preview: null, error: 'JSON valide mais sans tableau « categories »' };
    let products = 0;
    let variants = 0;
    for (const c of parsed.categories) {
      const ps = Array.isArray(c.products) ? c.products : [];
      products += ps.length;
      for (const p of ps) if (Array.isArray(p.variants)) variants += p.variants.length;
    }
    return { preview: { categories: parsed.categories.length, products, variants, title: parsed.meta?.title || null }, error: null };
  } catch (e) {
    return { preview: null, error: e instanceof Error ? e.message : 'JSON invalide' };
  }
}

export default function ImportJsonRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { preview, error: parseError } = useMemo(() => previewOf(json), [json]);

  if (!open) return null;

  const readFile = async (f: File) => {
    setFileName(f.name);
    setJson(await f.text());
    if (!notes) setNotes(`Import JSON — ${f.name}`);
  };

  const submit = async () => {
    setError('');
    if (!clientName.trim()) return setError('Le nom du client est requis.');
    if (!preview) return setError('Chargez ou collez un JSON de listing valide.');
    setBusy('create');
    try {
      const r1 = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          client_email: clientEmail.trim(),
          notes: (notes.trim() || (preview.title ? `Import JSON — ${preview.title}` : 'Import JSON')).slice(0, 500),
        }),
      });
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok || !d1?.id) throw new Error(d1?.error || 'Création de la demande impossible');
      setBusy('import');
      const r2 = await fetch(`/api/requests/${d1.id}/bulk-load`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json });
      const d2 = await r2.json().catch(() => ({}));
      if (!r2.ok) throw new Error(d2?.error || (Array.isArray(d2?.errors) ? d2.errors.join(' ; ') : 'Import impossible'));
      router.push(`/admin/requests/${d1.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => busy || onClose()}>
      <div className="my-6 w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white"><FileJson className="h-5 w-5 text-emerald-500" /> Nouvelle demande depuis un JSON</h2>
          <button type="button" onClick={onClose} disabled={!!busy} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-500">Importez le JSON d’un listing B2B ou B2C (format catalogue Twinsk). Une demande de sourcing est créée avec ses catégories et produits ; vous générez ensuite le devis ou la packing list depuis la fiche.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={label}>Client *</label><input className={field} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nom ou société" /></div>
            <div><label className={label}>Téléphone</label><input className={field} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+241 …" /></div>
            <div><label className={label}>E-mail</label><input className={field} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="optionnel" /></div>
            <div className="sm:col-span-3"><label className={label}>Notes</label><input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : devis pizzeria — quartier Louis" /></div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"><Upload className="h-4 w-4" /> Choisir un fichier .json</button>
              {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
            </div>
            <textarea className={`${field} mt-2 font-mono text-xs`} rows={7} value={json} onChange={(e) => setJson(e.target.value)} placeholder='… ou collez le JSON ici : { "meta": {...}, "categories": [ { "title": "...", "products": [ ... ] } ] }' />
            {parseError && <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {parseError}</p>}
            {preview && (
              <p className="mt-1 text-xs text-emerald-700">
                ✓ {preview.title ? `« ${preview.title} » · ` : ''}{preview.categories} catégorie(s) · {preview.products} produit(s) · {preview.variants} variante(s)
              </p>
            )}
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={!!busy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">Annuler</button>
            <button type="button" onClick={submit} disabled={!!busy || !preview || !clientName.trim()} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
              {busy === 'create' ? 'Création…' : busy === 'import' ? 'Import des produits…' : 'Créer la demande et importer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
