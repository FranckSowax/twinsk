'use client';

// Achats sur place — liste des voyages d'achat : un client vient acheter en
// Chine avec une liste ; l'équipe crée le voyage, lui envoie son lien, regroupe
// ses lignes en jours de visite, puis suit ses achats et le délai usine → cargo.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Loader2, Plus, ShoppingBasket } from 'lucide-react';
import { tripStatus, type BuyingTrip } from '@/lib/achats/logic';
import { Badge, btn, btnPrimary, input, label } from '@/components/projects/shared';

type Row = BuyingTrip & { items_count: number; bought_count: number };

export default function AchatsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', client_name: '', client_phone: '', cargo_cutoff: '' });
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/achats');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      setRows(j.trips || []);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/achats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      setCreating(false);
      setF({ title: '', client_name: '', client_phone: '', cargo_cutoff: '' });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  const copyLink = async (t: Row) => {
    const url = `${window.location.origin}/achat/${t.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(t.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt('Lien client :', url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-slate-900 dark:text-white"><ShoppingBasket className="h-6 w-6 text-emerald-600" /> Achats sur place</h1>
          <p className="text-sm text-slate-500">Le client envoie sa liste (texte, liens, photos) ; vous la regroupez en jours de visite ; sur place il coche, chiffre et photographie — total en ¥ et en FCFA, délai usine → cargo.</p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className={btnPrimary}><Plus className="h-4 w-4" /> Nouveau voyage</button>
      </div>

      {creating && (
        <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><label className={label}>Titre</label><input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex. Achats maison — Mme Diop, novembre" /></div>
          <div><label className={label}>Client</label><input className={input} value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} /></div>
          <div><label className={label}>WhatsApp du client</label><input className={input} inputMode="tel" value={f.client_phone} onChange={(e) => setF({ ...f, client_phone: e.target.value })} placeholder="+241 …" /></div>
          <div><label className={label}>Date limite au cargo</label><input type="date" className={input} value={f.cargo_cutoff} onChange={(e) => setF({ ...f, cargo_cutoff: e.target.value })} /></div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button type="button" disabled={busy || !f.title.trim()} onClick={create} className={btnPrimary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Créer et obtenir le lien client</button>
            <button type="button" onClick={() => setCreating(false)} className={btn}>Annuler</button>
          </div>
        </div>
      )}
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucun voyage d’achat. Créez-en un et envoyez le lien au client pour qu’il compose sa liste.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => {
            const s = tripStatus(t.status);
            return (
              <li key={t.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/achats/${t.id}`} className="min-w-0 font-semibold text-slate-900 hover:underline dark:text-white">{t.title}</Link>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <p className="text-xs text-slate-500">{t.client_name || 'Client à renseigner'}{t.client_phone ? ` · ${t.client_phone}` : ''}{t.cargo_cutoff ? ` · cargo le ${new Date(`${t.cargo_cutoff}T12:00:00`).toLocaleDateString('fr-FR')}` : ''}</p>
                <p className="text-xs text-slate-500">{t.items_count} ligne{t.items_count > 1 ? 's' : ''} · {t.bought_count} achetée{t.bought_count > 1 ? 's' : ''} · créé le {new Date(t.created_at).toLocaleDateString('fr-FR')}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Link href={`/admin/achats/${t.id}`} className={btnPrimary}>Ouvrir</Link>
                  <button type="button" onClick={() => copyLink(t)} className={btn}><Copy className="h-3.5 w-3.5" /> {copied === t.id ? 'Lien copié' : 'Lien client'}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
