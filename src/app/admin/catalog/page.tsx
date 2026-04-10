'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ExternalLink,
  Package,
  Store,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { formatCNY } from '@/lib/utils/formatCurrency';
import SmartImage from '@/components/ui/SmartImage';

interface CatalogItem {
  id: string;
  source: string;
  title: string;
  title_original: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  main_image_url: string | null;
  seller: string | null;
  product_url: string | null;
  moq: number | null;
  search_count: number;
  last_seen_at: string;
  created_at: string;
}

const SOURCE_BADGE: Record<string, string> = {
  taobao: 'bg-orange-100 text-orange-700',
  '1688': 'bg-blue-100 text-blue-700',
  factory: 'bg-purple-100 text-purple-700',
  manual: 'bg-emerald-100 text-emerald-700',
};

const SOURCE_LABEL: Record<string, string> = {
  taobao: 'Taobao',
  '1688': '1688',
  factory: 'Usine',
  manual: 'Manuel',
};

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const pageSize = 30;

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (source) params.set('source', source);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    const res = await fetch(`/api/catalog?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [query, source, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce produit du catalogue ?')) return;
    await fetch(`/api/catalog/${id}`, { method: 'DELETE' });
    loadData();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Catalogue produits
        </h1>
        <p className="mt-1 text-slate-500">
          {total} produit(s) et usine(s) dans la base
        </p>
      </div>

      {/* Search + Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit ou une usine..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Toutes sources</option>
          <option value="taobao">Taobao</option>
          <option value="1688">1688</option>
          <option value="factory">Usines</option>
          <option value="manual">Manuel</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow"
        >
          <Filter className="h-4 w-4" />
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-500">Aucun produit trouvé</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Prix</th>
                  <th className="px-4 py-3 text-center">MOQ</th>
                  <th className="px-4 py-3">Vendeur</th>
                  <th className="px-4 py-3 text-center">
                    <TrendingUp className="mx-auto h-3.5 w-3.5" />
                  </th>
                  <th className="px-4 py-3">Dernière vue</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                          {item.image_url ? (
                            <SmartImage
                              src={item.main_image_url || item.image_url}
                              fallbackSrc={item.image_url}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg">
                              {item.source === 'factory' ? '🏭' : '📦'}
                            </div>
                          )}
                        </div>
                        <p
                          className="max-w-[250px] truncate text-sm font-medium text-slate-900 dark:text-white"
                          title={item.title}
                        >
                          {item.title}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          SOURCE_BADGE[item.source] || SOURCE_BADGE.taobao
                        }`}
                      >
                        {SOURCE_LABEL[item.source] || item.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 dark:text-white">
                      {item.price > 0 ? formatCNY(item.price) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">
                      {item.moq ?? '—'}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-sm text-slate-500">
                      {item.seller || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                        {item.search_count}×
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(item.last_seen_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {item.product_url && (
                          <a
                            href={item.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-amber-500"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <p className="text-xs text-slate-500">
                Page {page}/{totalPages} — {total} résultat(s)
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                >
                  ← Préc.
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                >
                  Suiv. →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedItem(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
            >
              {/* Header image */}
              <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-900">
                {selectedItem.image_url ? (
                  <SmartImage
                    src={selectedItem.main_image_url || selectedItem.image_url}
                    fallbackSrc={selectedItem.image_url}
                    alt={selectedItem.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl">
                    {selectedItem.source === 'factory' ? '🏭' : '📦'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow"
                >
                  <X className="h-5 w-5" />
                </button>
                <span
                  className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold uppercase shadow ${
                    SOURCE_BADGE[selectedItem.source] || ''
                  }`}
                >
                  {SOURCE_LABEL[selectedItem.source] || selectedItem.source}
                </span>
              </div>

              <div className="space-y-4 p-6">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {selectedItem.title}
                </h2>
                {selectedItem.title_original &&
                  selectedItem.title_original !== selectedItem.title && (
                    <p className="text-xs italic text-slate-400">
                      {selectedItem.title_original}
                    </p>
                  )}

                {selectedItem.price > 0 && (
                  <p className="text-2xl font-bold text-amber-500">
                    {formatCNY(selectedItem.price)}
                  </p>
                )}

                {selectedItem.description && (
                  <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                    {selectedItem.description}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedItem.seller && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Store className="h-3.5 w-3.5" /> {selectedItem.seller}
                    </div>
                  )}
                  {selectedItem.moq != null && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Package className="h-3.5 w-3.5" /> MOQ: {selectedItem.moq}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5" /> Sourcé {selectedItem.search_count}×
                  </div>
                </div>

                {selectedItem.product_url && (
                  <a
                    href={selectedItem.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" /> Voir le produit
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
