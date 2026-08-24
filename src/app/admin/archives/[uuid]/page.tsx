'use client';

// Page simple d'un listing archivé : vignette, infos et partage du lien public
// (copie + WhatsApp). Accessible depuis la galerie /admin/archives.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ImageOff,
  Link2,
  Loader2,
  MessageCircle,
  Tag,
} from 'lucide-react';

interface Offer {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  status: string;
  cover_image_url: string | null;
  created_at: string;
  archived_at: string | null;
  offer_type?: string | null;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ArchiveSharePage() {
  const params = useParams<{ uuid: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [publicLink, setPublicLink] = useState('');

  useEffect(() => {
    if (!params?.uuid) return;
    setPublicLink(`${window.location.origin}/offer/${params.uuid}`);
    (async () => {
      try {
        const res = await fetch(`/api/offers/${params.uuid}`);
        if (res.ok) setOffer(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [params?.uuid]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiez le lien :', publicLink);
    }
  };

  const unarchive = async () => {
    if (!offer) return;
    if (!window.confirm(`Restaurer « ${offer.title} » dans la liste des offres ?`)) return;
    const res = await fetch(`/api/offers/${offer.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    });
    if (res.ok) window.location.href = '/admin/archives';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-500">Listing introuvable.</p>
        <Link href="/admin/archives" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> Retour aux archives
        </Link>
      </div>
    );
  }

  const waText = encodeURIComponent(`${offer.title}\n${publicLink}`);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/admin/archives"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" /> Archives
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {/* Vignette */}
        <div className="relative aspect-[16/9] bg-slate-100 dark:bg-slate-700">
          {offer.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.cover_image_url} alt={offer.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-500">
              <ImageOff className="h-12 w-12" />
            </div>
          )}
          {(offer.offer_type ?? 'b2c') === 'b2b' && (
            <span className="absolute left-3 top-3 rounded-full bg-blue-600/90 px-2.5 py-1 text-xs font-semibold text-white">
              B2B
            </span>
          )}
        </div>

        <div className="space-y-4 p-6">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">{offer.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {offer.archived_at ? `Archivé le ${fmtDate(offer.archived_at)} · ` : ''}
              créé le {fmtDate(offer.created_at)}
            </p>
            {offer.theme && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <Tag className="h-3 w-3" /> {offer.theme}
              </span>
            )}
            {offer.description && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{offer.description}</p>
            )}
          </div>

          {/* Lien public */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lien public du listing
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {publicLink}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>

          {/* Actions de partage */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <MessageCircle className="h-4 w-4" /> Partager sur WhatsApp
            </a>
            <Link
              href={`/offer/${offer.id}`}
              target="_blank"
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowUpRight className="h-4 w-4" /> Ouvrir la page publique
            </Link>
            <button
              type="button"
              onClick={unarchive}
              className="flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
            >
              <ArchiveRestore className="h-4 w-4" /> Restaurer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
