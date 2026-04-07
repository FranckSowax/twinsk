'use client';

import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';
import type { Request as RequestType, Quote } from '@/lib/types/database';

interface PackingItem {
  title: string;
  image_url: string;
  moq: number | null;
  quantity: number;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
}

interface PackingListPreviewProps {
  quote: Quote;
  request: RequestType;
  items: PackingItem[];
}

export default function PackingListPreview({ quote, request, items }: PackingListPreviewProps) {
  const totalWeight = items.reduce((sum, i) => sum + (i.weight || 0) * i.quantity, 0);
  const totalVolume = items.reduce((sum, i) => sum + (i.volume || 0) * i.quantity, 0);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Actions */}
      <div className="mb-6 flex items-center justify-end gap-3 print:hidden">
        <motion.button
          type="button"
          onClick={() => window.print()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </motion.button>
        <motion.a
          href={`/api/quotes/${quote.id}/pdf`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25"
        >
          <Download className="h-4 w-4" />
          Télécharger PDF
        </motion.a>
      </div>

      {/* Document */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl print:border-none print:shadow-none sm:p-12 dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-amber-500 pb-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-amber-500">TWINSK</h1>
            <p className="mt-1 text-sm text-slate-500">Logistics & Sourcing Company</p>
          </div>
          <div className="text-right">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">PACKING LIST</h2>
            <p className="mt-1 text-sm text-slate-500">N° {quote.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-slate-500">
              {new Date(quote.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Client */}
        <div className="mt-8 rounded-2xl bg-slate-50 p-6 dark:bg-slate-700/50">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Destinataire</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Nom</p>
              <p className="font-medium text-slate-900 dark:text-white">{request.client_name}</p>
            </div>
            {request.client_email ? (
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="font-medium text-slate-900 dark:text-white">{request.client_email}</p>
              </div>
            ) : null}
            {request.client_phone ? (
              <div>
                <p className="text-xs text-slate-400">Téléphone</p>
                <p className="font-medium text-slate-900 dark:text-white">{request.client_phone}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Table */}
        <div className="mt-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Détail du colisage</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="rounded-lg bg-slate-900 text-white dark:bg-slate-600">
                  <th className="rounded-l-lg px-3 py-3 text-left text-xs font-semibold uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Produit</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase">MOQ</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Qté</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Poids/u</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Total kg</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Vol/u</th>
                  <th className="rounded-r-lg px-3 py-3 text-center text-xs font-semibold uppercase">Dimensions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item, i) => {
                  const lineWeight = (item.weight || 0) * item.quantity;
                  return (
                    <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-700/20' : ''}>
                      <td className="px-3 py-3 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg print:hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                          </div>
                          <p className="text-slate-700 dark:text-slate-200">
                            {item.title.length > 50 ? item.title.slice(0, 50) + '…' : item.title}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">
                        {item.moq ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">{item.quantity}</td>
                      <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">
                        {item.weight != null ? item.weight.toFixed(3) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-900 dark:text-white">
                        {lineWeight ? lineWeight.toFixed(3) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">
                        {item.volume != null ? item.volume.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300">
                        {item.dimensions || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-8 flex justify-end border-t-2 border-amber-500 pt-6">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Nombre de produits</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Total unités</span>
              <span>{totalUnits}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Volume total</span>
              <span>{totalVolume.toFixed(4)} m³</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-600">
              <span className="text-lg font-bold text-slate-900 dark:text-white">POIDS TOTAL</span>
              <span className="text-lg font-bold text-amber-500">{totalWeight.toFixed(3)} kg</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-slate-200 pt-6 text-center dark:border-slate-700">
          <p className="text-xs text-slate-400">
            TWINSK Company — Logistics & Sourcing • Document de colisage à valeur informative
          </p>
        </div>
      </div>
    </div>
  );
}
