'use client';

// Galerie des listings archivés — vignette + accès à la page de partage.
// Une offre arrive ici via le bouton « Envoyer aux archives » de /admin/offer-b2b.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  Check,
  ImageOff,
  Link2,
  Loader2,
  Share2,
} from 'lucide-react';

interface OfferRow {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  cover_image_url: string | null;
  created_at: string;
  archived_at: string | null;
  offer_type?: string | null;
  offer_items: { count: number }[];
  offer_orders: { count: number }[];
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminArchivesPage() {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/offers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setOffers(data.filter((o: OfferRow) => !!o.archived_at));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copyLink = async (o: OfferRow) => {
    const link = `${window.location.origin}/offer/${o.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(o.id);
      setTimeout(() => setCopiedId((c) => (c === o.id ? null : c)), 2000);
    } catch {
      window.prompt('Copiez le lien :', link);
    }
  };

  const unarchive = async (o: OfferRow) => {
    if (!window.confirm(`Restaurer « ${o.title} » dans la liste des offres ?`)) return;
    const res = await fetch(`/api/offers/${o.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Erreur lors de la restauration');
      return;
    }
    setOffers((prev) => prev.filter((x) => x.id !== o.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
          <Archive className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Archives</h1>
          <p className="text-sm text-slate-500">
            {offers.length} listing(s) archivé(s) · les pages publiques restent partageables.
          </p>
        </div>
      </div>

      {!offers.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <Archive className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-500">
            Aucun listing archivé. Utilisez le bouton « Envoyer aux archives » sur la page Offres B2B.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {offers.map((o, i) => {
            const itemCount = o.offer_items?.[0]?.count ?? 0;
            return (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
              >
                {/* Vignette */}
                <Link href={`/admin/archives/${o.id}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-700">
                  {o.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.cover_image_url}
                      alt={o.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-500">
                      <ImageOff className="h-10 w-10" />
                    </div>
                  )}
                  {(o.offer_type ?? 'b2c') === 'b2b' && (
                    <span className="absolute left-2 top-2 rounded-full bg-blue-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                      B2B
                    </span>
                  )}
                  {o.archived_at && (
                    <span className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-white">
                      Archivé le {fmtDate(o.archived_at)}
                    </span>
                  )}
                </Link>

                {/* Infos */}
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <Link
                    href={`/admin/archives/${o.id}`}
                    className="line-clamp-2 font-semibold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300"
                  >
                    {o.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {o.theme ? `${o.theme} · ` : ''}
                    {itemCount} catégorie(s) · créé le {fmtDate(o.created_at)}
                  </p>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => copyLink(o)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                      title="Copier le lien public"
                    >
                      {copiedId === o.id ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                      {copiedId === o.id ? 'Copié !' : 'Copier le lien'}
                    </button>
                    <Link
                      href={`/admin/archives/${o.id}`}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                      title="Page de partage"
                    >
                      <Share2 className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/offer/${o.id}`}
                      target="_blank"
                      className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                      title="Ouvrir la page publique"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => unarchive(o)}
                      className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      title="Restaurer dans les offres"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
