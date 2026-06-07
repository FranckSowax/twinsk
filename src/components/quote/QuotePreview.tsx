'use client';

import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';
import { applyMargin, formatInCurrency, formatFcfaInCurrency, type CurrencyCode } from '@/lib/utils/formatCurrency';
import { computeQuoteTransport } from '@/lib/quote-transport';
import type { Request as RequestType, Quote } from '@/lib/types/database';

interface QuoteItemDisplay {
  title: string;
  description: string | null;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
  weight: number | null;
  volume: number | null;
  has_battery: boolean | null;
}

interface QuotePreviewProps {
  quote: Quote;
  request: RequestType;
  items: QuoteItemDisplay[];
}

const COMPANY_ADDRESS_LINE =
  'Twinsk Company Limited — Room 506, Tongyue Building, No. 7 Tongya East Street, Xicha Road, Baiyun District, Guangzhou — 广州市白云区西槎路同雅东街7号同粤大厦506 — 邓小姐 +86 13710816769 — contact@twinskcompanyltd.com';

export default function QuotePreview({ quote, request, items }: QuotePreviewProps) {
  const rawCur = (request as unknown as { proposal_currency?: string })
    .proposal_currency;
  const currency: CurrencyCode =
    rawCur === 'USD' || rawCur === 'EUR' || rawCur === 'XAF' || rawCur === 'CNY'
      ? rawCur
      : 'CNY';

  const transport = computeQuoteTransport(
    items.map((i) => ({
      quantity: i.quantity,
      weight: i.weight,
      volume: i.volume,
      has_battery: i.has_battery,
    })),
  );

  const itemsTotalCny = items.reduce(
    (sum, it) => sum + applyMargin(it.price, it.margin_percent) * it.quantity,
    0,
  );
  // Convert transport (FCFA) into CNY equivalent to add to grand total
  const transportFcfaPicked: number | null = (() => {
    const a = transport.airCostFcfa;
    const s = transport.seaCostFcfa;
    if (a != null && s != null) return Math.min(a, s);
    if (a != null) return a;
    if (s != null) return s;
    return null;
  })();
  const transportCnyPicked = transportFcfaPicked != null ? transportFcfaPicked / 90.45 : null;
  const grandTotalCny = itemsTotalCny + (transportCnyPicked ?? 0);

  const fmt = (cny: number) => formatInCurrency(cny, currency);
  const fmtFcfa = (fcfa: number) => formatFcfaInCurrency(fcfa, currency);

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
        {/* Header : logo + client */}
        <div className="flex items-start justify-between gap-8 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/twinsk-logo.jpg"
            alt="Twinsk"
            className="h-28 w-28 flex-shrink-0 object-contain"
          />
          <div className="flex-1 pt-4 text-center">
            <p className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {request.client_name || 'Client Twinsk'}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {request.client_email || request.client_phone || ''}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="mb-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Date : {new Date(quote.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            INVOICE N° : TWK{quote.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Twinsk company address */}
        <div className="mb-6 text-xs text-slate-600 dark:text-slate-400">
          <p>Room 506, Tongyue Building, No. 7 Tongya East Street,</p>
          <p>Xicha Road, Baiyun District, Guangzhou</p>
          <p>广州市白云区西槎路同雅东街7号同粤大厦506</p>
          <p>邓小姐 13710816769</p>
        </div>

        {/* Products + totals table */}
        <div className="overflow-hidden rounded-lg border border-slate-300">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '46%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white">
                <th className="border-r border-slate-300 px-3 py-2 text-left font-semibold">Produits</th>
                <th className="border-r border-slate-300 px-3 py-2 text-center font-semibold">Quantité</th>
                <th className="border-r border-slate-300 px-3 py-2 text-center font-semibold">Aera</th>
                <th className="border-r border-slate-300 px-3 py-2 text-center font-semibold">
                  P.U.<br />
                  <span className="text-[10px] text-slate-500">({currency})</span>
                </th>
                <th className="px-3 py-2 text-center font-semibold">
                  TOTAL<br />
                  <span className="text-[10px] text-slate-500">({currency})</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const final = applyMargin(it.price, it.margin_percent);
                const lineTotal = final * it.quantity;
                return (
                  <tr key={i} className="border-t border-slate-300 align-top">
                    <td className="border-r border-slate-300 p-3">
                      {it.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.image_url}
                          alt={it.title}
                          className="mb-2 h-16 w-16 rounded object-cover"
                        />
                      )}
                      <p className="font-semibold text-slate-900 dark:text-white">{it.title}</p>
                      {it.description && (
                        <p className="mt-1 line-clamp-6 text-xs text-slate-600 dark:text-slate-400">
                          {it.description}
                        </p>
                      )}
                    </td>
                    <td className="border-r border-slate-300 p-3 text-center">{it.quantity}</td>
                    <td className="border-r border-slate-300 p-3 text-center text-slate-400">—</td>
                    <td className="border-r border-slate-300 p-3 text-center">{fmt(final)}</td>
                    <td className="p-3 text-right font-bold">{fmt(lineTotal)}</td>
                  </tr>
                );
              })}

              {/* Sous Total FOB */}
              <tr className="border-t border-slate-300 bg-white">
                <td className="border-r border-slate-300 p-3 font-bold text-slate-900 dark:text-white" colSpan={1}>
                  Sous Total FOB
                </td>
                <td className="border-r border-slate-300" />
                <td className="border-r border-slate-300" />
                <td className="border-r border-slate-300" />
                <td className="p-3 text-right font-bold">{fmt(itemsTotalCny)}</td>
              </tr>

              {/* Aérien */}
              <tr className="border-t border-slate-300">
                <td className="border-r border-slate-300 p-3">
                  <p className="font-bold text-slate-900 dark:text-white">Pack Transport Aérien LBV</p>
                  {transport.airAvailable && transport.airCostFcfa != null ? (
                    <>
                      <p className="text-xs text-slate-600">
                        Chargement, transport départ, contrôle qualité, douane export, formalités admin Chine
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        Poids total : {transport.totalWeight!.toFixed(2)} kg{' '}
                        {transport.hasBattery ? '(avec batterie · 18 000 FCFA/kg)' : '(13 000 FCFA/kg)'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">À calculer — poids unitaire des produits à confirmer</p>
                  )}
                </td>
                <td className="border-r border-slate-300 p-3 text-center">{transport.airAvailable ? '1' : '—'}</td>
                <td className="border-r border-slate-300 p-3 text-center text-slate-400">—</td>
                <td className="border-r border-slate-300 p-3 text-center">
                  {transport.airCostFcfa != null ? fmtFcfa(transport.airCostFcfa) : <span className="text-slate-400">—</span>}
                </td>
                <td className="p-3 text-right font-bold">
                  {transport.airCostFcfa != null ? fmtFcfa(transport.airCostFcfa) : <span className="text-slate-400">—</span>}
                </td>
              </tr>

              {/* Maritime */}
              <tr className="border-t border-slate-300">
                <td className="border-r border-slate-300 p-3">
                  <p className="font-bold text-slate-900 dark:text-white">Pack Transport Maritime LBV (groupage)</p>
                  {transport.seaAvailable && transport.seaCostFcfa != null ? (
                    <>
                      <p className="text-xs text-slate-600">
                        Chargement, transport départ, contrôle qualité, douane export, formalités admin Chine
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        Volume marchandise (CBM) : {transport.totalVolume!.toFixed(4)} m³ (260 000 FCFA/m³)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">À calculer — volume (CBM) des produits à confirmer</p>
                  )}
                </td>
                <td className="border-r border-slate-300 p-3 text-center">{transport.seaAvailable ? '1' : '—'}</td>
                <td className="border-r border-slate-300 p-3 text-center text-slate-400">—</td>
                <td className="border-r border-slate-300 p-3 text-center">
                  {transport.seaCostFcfa != null ? fmtFcfa(transport.seaCostFcfa) : <span className="text-slate-400">—</span>}
                </td>
                <td className="p-3 text-right font-bold">
                  {transport.seaCostFcfa != null ? fmtFcfa(transport.seaCostFcfa) : <span className="text-slate-400">—</span>}
                </td>
              </tr>

              {/* Separator black */}
              <tr>
                <td colSpan={5} className="h-1 bg-slate-900" />
              </tr>

              {/* Total à Payer */}
              <tr>
                <td className="border-r border-slate-300 p-3 text-base font-bold text-slate-900 dark:text-white" colSpan={1}>
                  Total à Payer
                </td>
                <td className="border-r border-slate-300" />
                <td className="border-r border-slate-300" />
                <td className="border-r border-slate-300" />
                <td className="p-3 text-right text-base font-bold text-slate-900 dark:text-white">{fmt(grandTotalCny)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legal note */}
        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
          Le présent devis porte sur une prestation d&apos;une durée de{' '}
          <strong>quinze (15) jours</strong>, pour un montant global de{' '}
          <strong>{fmt(grandTotalCny)}</strong>.
        </p>

        {/* Footer */}
        <p className="mt-12 border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400 dark:border-slate-700">
          {COMPANY_ADDRESS_LINE}
        </p>
      </div>
    </div>
  );
}
