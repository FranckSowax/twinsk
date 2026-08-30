'use client';

// Liste des offres (B2C et B2B) — composant PARTAGÉ entre /admin/offer et
// /admin/offer-b2b : mêmes fonctionnalités, seul le type diffère. La page
// détail /admin/offer/[uuid] sert les deux types.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Archive,
  ArrowUpRight,
  Eye,
  Loader2,
  Package,
  Plus,
  Store,
  Tag,
  Trash2,
} from 'lucide-react';

interface OfferRow {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  cover_image_url: string | null;
  created_at: string;
  offer_type?: string | null; // 'b2c' (défaut) | 'b2b'
  archived_at?: string | null; // non null = aux archives (/admin/archives)
  offer_items: { count: number }[];
  offer_orders: { count: number }[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  published: { label: 'Publiée', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  closed: { label: 'Clôturée', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

export default function OffersListPage({ type }: { type: 'b2c' | 'b2b' }) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');

  const isB2B = type === 'b2b';

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/offers');
      const data = await res.json();
      if (Array.isArray(data)) {
        // Filtre côté client : robuste avant/après la migration 36 (offer_type
        // absent = b2c historique). Les offres archivées vivent sur /admin/archives.
        setOffers(
          data.filter((o: OfferRow) => (o.offer_type ?? 'b2c') === type && !o.archived_at),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, theme, description, offer_type: type }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) {
        alert(data?.error || 'Erreur création');
        return;
      }
      window.location.href = `/admin/offer/${data.id}`;
    } finally {
      setCreating(false);
    }
  };

  const [catalogSyncing, setCatalogSyncing] = useState<string | null>(null);

  // Publie/synchronise les produits du listing dans le catalogue WhatsApp Business.
  const syncCatalog = async (o: OfferRow) => {
    if (!window.confirm(`Publier « ${o.title} » au catalogue WhatsApp Business ?\n(produits avec prix + image ; les « sur devis » sont ignorés)`)) return;
    setCatalogSyncing(o.id);
    try {
      const res = await fetch(`/api/offers/${o.id}/catalog-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(`❌ ${d.error || 'Échec de la synchro'}`);
        return;
      }
      alert(
        `✅ Catalogue WhatsApp à jour\n` +
          `${d.created} créé(s) · ${d.updated} mis à jour` +
          (d.skipped ? ` · ${d.skipped} ignoré(s) (sur devis / sans image)` : '') +
          (d.collection ? `\nCollection : ${d.collection}` : '') +
          (d.errors?.length ? `\n⚠️ ${d.errors.join('\n')}` : ''),
      );
    } catch {
      alert('❌ Erreur réseau');
    } finally {
      setCatalogSyncing(null);
    }
  };

  const archiveOffer = async (o: OfferRow) => {
    if (!window.confirm(`Envoyer « ${o.title} » aux archives ? (récupérable depuis la page Archives)`)) return;
    const res = await fetch(`/api/offers/${o.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Erreur lors de l’archivage');
      return;
    }
    setOffers((prev) => prev.filter((x) => x.id !== o.id));
  };

  const removeOffer = async (id: string) => {
    if (!window.confirm('Supprimer cette offre et toutes ses données ?')) return;
    const res = await fetch(`/api/offers/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Erreur suppression');
      return;
    }
    setOffers((prev) => prev.filter((o) => o.id !== id));
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {isB2B ? 'Offres B2B' : 'Offres B2C'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {offers.length} offre(s) au total ·{' '}
            {isB2B
              ? 'offres dédiées aux professionnels (restaurants, boutiques, revendeurs…).'
              : 'partagez le lien public dans vos groupes et réseaux sociaux pour générer des ventes.'}
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCreateOpen(true)}
          className={`flex items-center gap-2 rounded-xl bg-gradient-to-r px-5 py-2.5 text-sm font-semibold text-white shadow-lg ${
            isB2B
              ? 'from-blue-500 to-indigo-500 shadow-blue-500/25'
              : 'from-emerald-500 to-green-500 shadow-emerald-500/25'
          }`}
        >
          <Plus className="h-4 w-4" />
          {isB2B ? 'Nouvelle offre B2B' : 'Nouvelle offre'}
        </motion.button>
      </div>

      {createOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`space-y-3 rounded-2xl border p-5 ${
            isB2B
              ? 'border-blue-200 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-900/10'
              : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10'
          }`}
        >
          <p className={`text-sm font-semibold ${isB2B ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
            {isB2B ? 'Créer une nouvelle offre B2B' : 'Créer une nouvelle offre'}
          </p>
          <input
            type="text"
            placeholder={isB2B ? "Titre de l'offre (ex: Pack équipement restaurant pro)" : "Titre de l'offre (ex: Pack démarrage restaurant)"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <input
            type="text"
            placeholder="Thème (ex: Restauration, Black Friday, Rentrée…)"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <textarea
            placeholder="Description courte (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Annuler
            </button>
            <motion.button
              type="button"
              onClick={create}
              disabled={!title.trim() || creating}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 rounded-xl bg-gradient-to-r px-5 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60 ${
                isB2B
                  ? 'from-blue-500 to-indigo-500 shadow-blue-500/25'
                  : 'from-emerald-500 to-green-500 shadow-emerald-500/25'
              }`}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer
            </motion.button>
          </div>
        </motion.div>
      )}

      {!offers.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-500">
            {isB2B ? 'Aucune offre B2B pour le moment' : 'Aucune offre pour le moment'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Titre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Thème</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Catégories</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Commandes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {offers.map((o, i) => {
                  const status = STATUS_LABEL[o.status] || STATUS_LABEL.draft;
                  const itemCount = o.offer_items?.[0]?.count ?? 0;
                  const orderCount = o.offer_orders?.[0]?.count ?? 0;
                  return (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{o.title}</p>
                        {o.description && (
                          <p className="line-clamp-1 max-w-xs text-xs text-slate-500">{o.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {o.theme ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            <Tag className="h-3 w-3" />
                            {o.theme}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(o.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {itemCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {orderCount}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/offer/${o.id}`}
                            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                            title="Voir"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {o.status === 'published' && (
                            <Link
                              href={`/offer/${o.id}`}
                              target="_blank"
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                              title="Voir la page publique"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          )}
                          {o.status === 'published' && (
                            <button
                              type="button"
                              onClick={() => syncCatalog(o)}
                              disabled={catalogSyncing === o.id}
                              className="rounded-lg p-1.5 text-[#25D366] hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-900/20"
                              title="Publier au catalogue WhatsApp Business"
                            >
                              {catalogSyncing === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                            </button>
                          )}
                          {isB2B && (o.status === 'published' || o.status === 'closed') && (
                            <button
                              type="button"
                              onClick={() => archiveOffer(o)}
                              className="rounded-lg p-1.5 text-indigo-500 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                              title="Envoyer aux archives"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeOffer(o.id)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
