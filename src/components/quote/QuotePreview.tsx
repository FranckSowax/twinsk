'use client';

import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';
import type { Request as RequestType, Quote, SearchResult } from '@/lib/types/database';

interface QuoteItemDisplay {
  title: string;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
}

interface QuotePreviewProps {
  quote: Quote;
  request: RequestType;
  items: QuoteItemDisplay[];
}

export default function QuotePreview({ quote, request, items }: QuotePreviewProps) {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Actions bar */}
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

      {/* Quote document */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl print:border-none print:shadow-none sm:p-12 dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-amber-500 pb-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-amber-500">
              TWINSK
            </h1>
            <p className="mt-1 text-sm text-slate-500">Logistics & Sourcing Company</p>
          </div>
          <div className="text-right">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              DEVIS
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              N° {quote.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-sm text-slate-500">
              {new Date(quote.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Client info */}
        <div className="mt-8 rounded-2xl bg-slate-50 p-6 dark:bg-slate-700/50">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Informations client
          </h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Nom</p>
              <p className="font-medium text-slate-900 dark:text-white">{request.client_name}</p>
            </div>
            {request.client_email && (
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="font-medium text-slate-900 dark:text-white">{request.client_email}</p>
              </div>
            )}
            {request.client_phone && (
              <div>
                <p className="text-xs text-slate-400">Téléphone</p>
                <p className="font-medium text-slate-900 dark:text-white">{request.client_phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Products table */}
        <div className="mt-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Détail des produits
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="rounded-lg bg-slate-900 text-white dark:bg-slate-600">
                  <th className="rounded-l-lg px-4 py-3 text-left text-xs font-semibold uppercase">Produit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Prix unit.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Qté</th>
                  <th className="rounded-r-lg px-4 py-3 text-right text-xs font-semibold uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item, i) => {
                  const finalPrice = applyMargin(item.price, item.margin_percent);
                  const lineTotal = finalPrice * item.quantity;

                  return (
                    <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-700/20' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg print:hidden">
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-200">
                            {item.title.length > 50 ? item.title.slice(0, 50) + '...' : item.title}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                        {formatCNY(finalPrice)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCNY(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total */}
        <div className="mt-8 flex justify-end border-t-2 border-amber-500 pt-6">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Nombre de produits</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-600">
              <span className="text-lg font-bold text-slate-900 dark:text-white">TOTAL</span>
              <span className="text-lg font-bold text-amber-500">
                {formatCNY(quote.total_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-slate-200 pt-6 text-center dark:border-slate-700">
          <p className="text-xs text-slate-400">
            TWINSK Company — Logistics & Sourcing • Ce devis est valable 30 jours
          </p>
        </div>
      </div>
    </div>
  );
}
