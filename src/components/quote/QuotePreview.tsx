'use client';

import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';
import { applyMargin, formatInCurrency, type CurrencyCode } from '@/lib/utils/formatCurrency';
import { computeQuoteTransport } from '@/lib/quote-transport';
import type { Request as RequestType, Quote } from '@/lib/types/database';

interface QuoteVariantDisplay {
  id: string;
  name: string;
  price: number | null;
  is_main: boolean;
}

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
  variants?: QuoteVariantDisplay[];
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

  const destinationCode = (request as unknown as { destination?: string | null }).destination ?? null;
  const transport = computeQuoteTransport(
    items.map((i) => ({
      quantity: i.quantity,
      weight: i.weight,
      volume: i.volume,
      has_battery: i.has_battery,
    })),
    destinationCode,
  );

  /**
   * Prix unitaire applique pour le calcul du total : celui de la variante
   * principale s il existe, sinon le prix du produit. La marge s applique
   * ensuite.
   */
  const unitPriceFor = (it: QuoteItemDisplay): number => {
    const main = it.variants?.find((v) => v.is_main);
    if (main && typeof main.price === 'number') return main.price;
    return it.price;
  };

  const itemsTotalCny = items.reduce(
    (sum, it) => sum + applyMargin(unitPriceFor(it), it.margin_percent) * it.quantity,
    0,
  );
  const transportCnyPicked: number | null = (() => {
    const a = transport.airCostCny;
    const s = transport.seaCostCny;
    if (a != null && s != null) return Math.min(a, s);
    if (a != null) return a;
    if (s != null) return s;
    return null;
  })();
  const grandTotalCny = itemsTotalCny + (transportCnyPicked ?? 0);
  const hub = transport.hub;
  const destLabel = transport.destinationLabel;

  const fmt = (cny: number) => formatInCurrency(cny, currency);
  const fmtNative = (amount: number, native: typeof transport.nativeCurrency, decimals = 0) => {
    const v = amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (native === 'XAF') return `${v} FCFA`;
    if (native === 'EUR') return `${v} €`;
    if (native === 'USD') return `$${v}`;
    return `${v} ${native}`;
  };
  const fmtNativeRate = (rate: number) => fmtNative(rate, transport.nativeCurrency);

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
                const unitBase = unitPriceFor(it);
                const final = applyMargin(unitBase, it.margin_percent);
                const lineTotal = final * it.quantity;
                const variants = it.variants || [];
                const mainVariant = variants.find((v) => v.is_main);
                const otherVariants = variants.filter((v) => !v.is_main);
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
                      {variants.length > 0 && (
                        <div className="mt-2 space-y-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                          {mainVariant && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {mainVariant.name}
                                <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] uppercase tracking-wider text-amber-700">
                                  variante retenue
                                </span>
                              </span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {mainVariant.price != null
                                  ? fmt(applyMargin(mainVariant.price, it.margin_percent))
                                  : '—'}
                              </span>
                            </div>
                          )}
                          {otherVariants.map((v) => (
                            <div
                              key={v.id || v.name}
                              className="flex items-center justify-between gap-3 text-slate-400 line-through decoration-slate-300"
                            >
                              <span>
                                {v.name}
                                <span className="ml-1 text-[10px] uppercase tracking-wider no-underline">
                                  (option · non comptée)
                                </span>
                              </span>
                              <span>
                                {v.price != null
                                  ? fmt(applyMargin(v.price, it.margin_percent))
                                  : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
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
                  <p className="font-bold text-slate-900 dark:text-white">Pack Transport Aérien {hub}</p>
                  {transport.airAvailable && transport.airCostCny != null ? (
                    <>
                      <p className="text-xs text-slate-600">
                        Destination : {destLabel} · Chargement, transport départ, contrôle qualité,
                        douane export, formalités admin Chine
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        Poids total : {transport.totalWeight!.toFixed(2)} kg ({fmtNativeRate(transport.airRatePerKg)}/kg{transport.hasBattery ? ' · avec batterie' : ''})
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">À calculer — poids unitaire des produits à confirmer</p>
                  )}
                </td>
                <td className="border-r border-slate-300 p-3 text-center">{transport.airAvailable ? '1' : '—'}</td>
                <td className="border-r border-slate-300 p-3 text-center text-slate-400">—</td>
                <td className="border-r border-slate-300 p-3 text-center">
                  {transport.airCostCny != null ? fmt(transport.airCostCny) : <span className="text-slate-400">—</span>}
                </td>
                <td className="p-3 text-right font-bold">
                  {transport.airCostCny != null ? fmt(transport.airCostCny) : <span className="text-slate-400">—</span>}
                </td>
              </tr>

              {/* Maritime */}
              <tr className="border-t border-slate-300">
                <td className="border-r border-slate-300 p-3">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Pack Transport Maritime {hub}
                    {transport.seaModeLabel ? ` — ${transport.seaModeLabel}` : ''}
                  </p>
                  {transport.seaAvailable && transport.seaCostCny != null ? (
                    <>
                      <p className="text-xs text-slate-600">
                        Destination : {destLabel} · Chargement, transport départ, contrôle qualité,
                        douane export, formalités admin Chine
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        Volume marchandise (CBM) : {transport.totalVolume!.toFixed(4)} m³
                        {transport.seaMode === 'groupage'
                          ? ` (${fmtNativeRate(transport.seaRatePerCbm)}/m³)`
                          : transport.seaCostNative != null
                            ? ` — forfait : ${fmtNative(transport.seaCostNative, transport.seaCostCurrency, transport.seaCostCurrency === 'XAF' ? 0 : 2)}`
                            : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">À calculer — volume (CBM) des produits à confirmer</p>
                  )}
                </td>
                <td className="border-r border-slate-300 p-3 text-center">
                  {transport.seaAvailable
                    ? (transport.seaContainerCount > 1 ? transport.seaContainerCount : '1')
                    : '—'}
                </td>
                <td className="border-r border-slate-300 p-3 text-center text-slate-400">—</td>
                <td className="border-r border-slate-300 p-3 text-center">
                  {transport.seaCostCny != null ? fmt(transport.seaCostCny) : <span className="text-slate-400">—</span>}
                </td>
                <td className="p-3 text-right font-bold">
                  {transport.seaCostCny != null ? fmt(transport.seaCostCny) : <span className="text-slate-400">—</span>}
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
