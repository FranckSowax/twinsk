import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import {
  type CurrencyCode,
  formatInCurrency,
} from '@/lib/utils/formatCurrency';
import { normalizeQuoteTransportMode, pickQuoteTransportCny, quoteModesShown, transitLabelDays, type QuoteTransportMode, type QuoteTransportSummary } from '@/lib/quote-transport';
import { ensureCjkFont } from '@/lib/pdf/fonts';
import { stripMarkdown, truncateOnWord } from '@/lib/utils/stripMarkdown';
import { groupQuoteItems } from '@/lib/quote-groups';

// Nombre max de variantes non retenues listees dans la cellule produit.
// Au-dela, la ligne devenait plus haute qu une page : react-pdf la renvoyait
// en page 2 et laissait la page 1 vide sous l en-tete.
const MAX_OPTION_ROWS = 6;
const DESCRIPTION_MAX_CHARS = 340;

const COMPANY_ADDRESS_LINE =
  'Twinsk Company Limited — Room 506, Tongyue Building, No. 7 Tongya East Street, Xicha Road, Baiyun District, Guangzhou — 广州市白云区西槎路同雅东街7号同粤大厦506 — 邓小姐 +86 13710816769 — contact@twinskcompanyltd.com';

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingHorizontal: 40,
    paddingBottom: 48,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },

  // En-tête : société à gauche, document à droite, trait épais dessous
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
  },
  companyRow: { flexDirection: 'row', alignItems: 'flex-start', flexShrink: 1, paddingRight: 12 },
  logoBlock: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  logoImage: { width: 64, height: 64, objectFit: 'contain' },
  logoText: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a', letterSpacing: 1.5 },
  logoSubText: { fontSize: 5, color: '#475569', marginTop: 2, letterSpacing: 1, textAlign: 'center' },
  logoLine: { width: 40, height: 1, backgroundColor: '#0f172a', marginVertical: 3 },
  logoSubText2: { fontSize: 5, color: '#475569', letterSpacing: 1, textAlign: 'center' },
  companyBlock: { paddingLeft: 10, flexShrink: 1 },
  companyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0f172a', letterSpacing: 0.5, marginBottom: 1 },
  companyTagline: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#b45309', letterSpacing: 0.5, marginBottom: 3 },
  companyLine: { fontSize: 8, color: '#475569', lineHeight: 1.4 },
  docBlock: { alignItems: 'flex-end', flexShrink: 0 },
  docTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', letterSpacing: 2 },
  docSubtitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', letterSpacing: 2, marginBottom: 6 },
  docNumber: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  docDate: { fontSize: 9, color: '#475569', marginBottom: 6 },
  transportPill: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  transportPillText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#334155' },

  // Cartes « Facturé à » / « Conditions »
  cardsRow: { flexDirection: 'row', marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 6, padding: 10, marginRight: 8 },
  cardLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', letterSpacing: 0.8, marginBottom: 3 },
  cardClientName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 2 },
  cardLine: { fontSize: 8.5, color: '#475569', lineHeight: 1.45 },
  cardStrong: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },

  // Products table
  table: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    marginBottom: 0,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    padding: 6,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    minHeight: 40,
  },
  tableCell: {
    fontSize: 9,
    color: '#1e293b',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    textAlign: 'center',
    justifyContent: 'center',
  },
  productCell: {
    fontSize: 9,
    color: '#1e293b',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    textAlign: 'left',
  },
  productTitleBold: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#0f172a',
  },
  productImage: {
    width: 44,
    height: 44,
    marginBottom: 4,
    objectFit: 'cover',
  },
  totalRowGrand: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    minHeight: 4,
  },
  totalRowFinal: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    minHeight: 36,
    backgroundColor: '#ffffff',
  },
  totalLabelCell: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    textAlign: 'left',
  },
  totalValueCell: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    padding: 10,
    textAlign: 'right',
  },

  // Lignes de variantes : sans flex explicite, react-pdf ne retrecit pas le
  // libelle et le prix venait se superposer au texte.
  variantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 1.5,
  },
  variantName: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingRight: 6,
    fontSize: 7.5,
  },
  variantPrice: {
    flexGrow: 0,
    flexShrink: 0,
    width: 56,
    textAlign: 'right',
    fontSize: 7.5,
  },

  // Cols widths
  colProduct: { width: '46%' },
  colQty: { width: '11%' },
  colArea: { width: '8%' },
  colUnit: { width: '15%' },
  colTotal: { width: '20%' },
  colTotalLast: { width: '20%', borderRightWidth: 0 },

  // Note legale
  legalNote: {
    fontSize: 9,
    color: '#1e293b',
    marginTop: 12,
  },

  // Page footer (full address)
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
  },
});

interface QuoteVariant {
  id: string;
  name: string;
  price: number | null;
  is_main: boolean;
}

interface QuoteItem {
  /** Clé de regroupement des variantes d'un même produit. */
  product_key?: string | null;
  title: string;
  /** Renseigné quand la ligne est une variante retenue du produit. */
  variant_name?: string | null;
  description?: string | null;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
  variants?: QuoteVariant[];
}

interface QuotePDFProps {
  quoteId: string;
  quoteDate: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  items: QuoteItem[];
  totalAmountCny: number;
  currency?: CurrencyCode;
  transport?: QuoteTransportSummary | null;
  /** Mode retenu à la génération : seul le pack correspondant est affiché. */
  transportMode?: QuoteTransportMode | null;
  logoUrl?: string;
}

function fmt(amountCny: number, currency: CurrencyCode): string {
  return formatInCurrency(amountCny, currency);
}

function fmtNativeRate(rate: number, native: CurrencyCode): string {
  // Affichage compact des tarifs unitaires natifs (ex : "13,000 FCFA/kg").
  const formatted = rate.toLocaleString('en-US');
  if (native === 'XAF') return `${formatted} FCFA`;
  if (native === 'EUR') return `${formatted} €`;
  if (native === 'USD') return `$${formatted}`;
  return `${formatted} ${native}`;
}

function fmtNativeAmount(amount: number, native: CurrencyCode): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: native === 'XAF' ? 0 : 2,
    maximumFractionDigits: native === 'XAF' ? 0 : 2,
  });
  if (native === 'XAF') return `${formatted} FCFA`;
  if (native === 'EUR') return `${formatted} €`;
  if (native === 'USD') return `$${formatted}`;
  return `${formatted} ${native}`;
}

export default function QuotePDF({
  quoteId,
  quoteDate,
  clientName,
  clientEmail,
  clientPhone,
  items,
  totalAmountCny,
  currency = 'CNY',
  transport,
  transportMode,
  logoUrl,
}: QuotePDFProps) {
  // Compute totals — si l item a des variantes, on utilise le prix de la
  // variante principale (is_main). Sinon le prix produit.
  const unitPriceFor = (it: QuoteItem): number => {
    const main = it.variants?.find((v) => v.is_main);
    if (main && typeof main.price === 'number') return main.price;
    return it.price;
  };
  const itemsTotalCny = items.reduce(
    (sum, it) =>
      sum + unitPriceFor(it) * (1 + it.margin_percent / 100) * it.quantity,
    0,
  );

  // Couts transport dans la devise du devis (CNY). On affiche les 2 modes ;
  // le "Total a payer" prend le moins cher disponible (cas B2B le plus courant).
  const mode = normalizeQuoteTransportMode(transportMode);
  const shown = quoteModesShown(mode, transport?.trainOffered ?? false);
  const showAir = shown.air;
  const showSea = shown.sea;
  const showTrain = shown.train;
  const finalTransportCny: number | null = transport
    ? pickQuoteTransportCny(
        {
          airCostCny: transport.airAvailable ? transport.airCostCny : null,
          seaCostCny: transport.seaAvailable ? transport.seaCostCny : null,
          trainCostCny: transport.trainAvailable ? transport.trainCostCny : null,
        },
        mode,
      )
    : null;
  const delay = (m: 'air' | 'sea' | 'train') => (transport ? transitLabelDays(transport.transitDays[m]) : null);
  const taxableNote =
    transport && transport.volumetricWeight != null && transport.chargeableWeight != null && transport.totalWeight != null
      ? ` — poids taxable ${transport.chargeableWeight.toFixed(2)} kg (réel ${transport.totalWeight.toFixed(2)} kg, volumétrique ${transport.volumetricWeight.toFixed(2)} kg)`
      : '';
  const grandTotalCny = itemsTotalCny + (finalTransportCny ?? 0);
  const destLabel = transport?.destinationLabel || 'Gabon (Libreville)';
  // Police embarquee pour les lignes contenant du chinois (adresse + footer).
  const cjk = ensureCjkFont();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête : société (gauche) · document (droite) — même agencement que l'aperçu */}
        <View style={styles.header}>
          <View style={styles.companyRow}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logoImage} />
            ) : (
              <View style={styles.logoBlock}>
                <Text style={styles.logoSubText2}>TWINSK</Text>
                <View style={styles.logoLine} />
                <Text style={styles.logoText}>HONG KONG</Text>
                <View style={styles.logoLine} />
                <Text style={styles.logoSubText}>COMPANY LIMITED</Text>
              </View>
            )}
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>TWINSK COMPANY LTD</Text>
              <Text style={styles.companyTagline}>LOGISTICS & SOURCING · HONG KONG · GUANGZHOU</Text>
              <Text style={styles.companyLine}>Room 506, Tongyue Building, No. 7 Tongya East Street,</Text>
              <Text style={styles.companyLine}>Xicha Road, Baiyun District, Guangzhou</Text>
              <Text style={[styles.companyLine, { fontFamily: cjk }]}>广州市白云区西槎路同雅东街7号同粤大厦506</Text>
              <Text style={[styles.companyLine, { fontFamily: cjk }]}>邓小姐 +86 137 1081 6769 · contact@twinskcompanyltd.com</Text>
            </View>
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>FACTURE</Text>
            <Text style={styles.docSubtitle}>INVOICE</Text>
            <Text style={styles.docNumber}>N° TWK{quoteId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.docDate}>Date : {quoteDate}</Text>
            <View style={styles.transportPill}>
              <Text style={styles.transportPillText}>
                {mode === 'air' ? 'Transport aérien' : mode === 'sea' ? 'Transport maritime' : mode === 'train' ? 'Transport ferroviaire' : 'Transport au choix'} · Door to Door
              </Text>
            </View>
          </View>
        </View>

        {/* Client + conditions : deux cartes, comme à l'écran */}
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>FACTURÉ À</Text>
            <Text style={styles.cardClientName}>{clientName || 'Client Twinsk'}</Text>
            {clientEmail ? <Text style={styles.cardLine}>{clientEmail}</Text> : null}
            {clientPhone ? <Text style={styles.cardLine}>{clientPhone}</Text> : null}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CONDITIONS</Text>
            <Text style={styles.cardLine}>
              Devise : <Text style={styles.cardStrong}>{currency}</Text> · Prix FOB Chine, transport détaillé ci-dessous
            </Text>
            <Text style={styles.cardLine}>
              Validité : <Text style={styles.cardStrong}>15 jours</Text> · Paiement à la commande
            </Text>
            <Text style={styles.cardLine}>
              Destination : <Text style={styles.cardStrong}>{destLabel}</Text>
            </Text>
          </View>
        </View>

        {/* Products table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colProduct, { textAlign: 'left' }]}>
              Produits
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Quantité</Text>
            <Text style={[styles.tableHeaderCell, styles.colArea]}>Aera</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit]}>
              P.U.{'\n'}({currency})
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colTotalLast]}>
              TOTAL{'\n'}({currency})
            </Text>
          </View>

          {/* Data rows */}
          {groupQuoteItems(items).map((g, gi) => {
            if (g.kind === 'variants') {
              const p = g.product;
              const description = p.description ? truncateOnWord(stripMarkdown(p.description), DESCRIPTION_MAX_CHARS) : '';
              return (
                <View key={`g-${gi}`}>
                  {/* Produit : titre en gras + description, une seule fois */}
                  <View style={styles.tableRow}>
                    <View style={[styles.productCell, styles.colProduct]}>
                      {p.image_url ? <Image src={p.image_url} style={styles.productImage} /> : null}
                      <Text style={styles.productTitleBold}>{p.title}</Text>
                      {description ? <Text style={{ fontSize: 8, color: '#475569', lineHeight: 1.3 }}>{description}</Text> : null}
                    </View>
                    <Text style={[styles.tableCell, styles.colQty, { fontSize: 7.5, color: '#94a3b8' }]}>
                      {g.variants.length} variante{g.variants.length > 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.tableCell, styles.colArea]} />
                    <Text style={[styles.tableCell, styles.colUnit]} />
                    <Text style={[styles.tableCell, styles.colTotalLast]} />
                  </View>
                  {/* Variantes retenues : nom en gras sur bandeau bleu, prix / quantité / total en face */}
                  {g.variants.map((v, vi) => {
                    const finalPrice = v.price * (1 + v.margin_percent / 100);
                    return (
                      <View key={`v-${gi}-${vi}`} style={[styles.tableRow, { minHeight: 24, backgroundColor: '#eff6ff' }]}>
                        <View style={[styles.productCell, styles.colProduct, { paddingLeft: 14, justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0c4a6e', borderLeftWidth: 3, borderLeftColor: '#0284c7', paddingLeft: 5 }}>
                            {v.variant_name}
                          </Text>
                        </View>
                        <Text style={[styles.tableCell, styles.colQty, { fontFamily: 'Helvetica-Bold' }]}>{v.quantity}</Text>
                        <Text style={[styles.tableCell, styles.colArea]}>—</Text>
                        <Text style={[styles.tableCell, styles.colUnit]}>{fmt(finalPrice, currency)}</Text>
                        <Text style={[styles.tableCell, styles.colTotalLast, { fontFamily: 'Helvetica-Bold' }]}>{fmt(finalPrice * v.quantity, currency)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            }
            const item = g.item;
            const index = gi;
            const unitBase = unitPriceFor(item);
            const finalPrice = unitBase * (1 + item.margin_percent / 100);
            const lineTotal = finalPrice * item.quantity;
            const variants = item.variants || [];
            const mainVariant = variants.find((v) => v.is_main) || null;
            const otherVariants = variants.filter((v) => !v.is_main);
            const shownOptions = otherVariants.slice(0, MAX_OPTION_ROWS);
            const hiddenOptions = otherVariants.length - shownOptions.length;
            const description = item.description
              ? truncateOnWord(stripMarkdown(item.description), DESCRIPTION_MAX_CHARS)
              : '';
            return (
              <View key={index} style={styles.tableRow}>
                <View style={[styles.productCell, styles.colProduct]}>
                  {item.image_url ? (
                    <Image src={item.image_url} style={styles.productImage} />
                  ) : null}
                  <Text style={styles.productTitleBold}>{item.title}</Text>
                  {description ? (
                    <Text style={{ fontSize: 8, color: '#475569', lineHeight: 1.3 }}>
                      {description}
                    </Text>
                  ) : null}
                  {variants.length > 0 ? (
                    <View
                      style={{
                        marginTop: 4,
                        paddingTop: 3,
                        borderTopWidth: 0.5,
                        borderTopColor: '#e2e8f0',
                      }}
                    >
                      {mainVariant ? (
                        <View style={styles.variantRow}>
                          <Text
                            style={[
                              styles.variantName,
                              { color: '#0f172a', fontFamily: 'Helvetica-Bold' },
                            ]}
                          >
                            {mainVariant.name} (variante retenue)
                          </Text>
                          <Text
                            style={[
                              styles.variantPrice,
                              { color: '#0f172a', fontFamily: 'Helvetica-Bold' },
                            ]}
                          >
                            {mainVariant.price != null
                              ? fmt(mainVariant.price * (1 + item.margin_percent / 100), currency)
                              : '—'}
                          </Text>
                        </View>
                      ) : null}
                      {shownOptions.map((v) => (
                        <View key={v.id || v.name} style={styles.variantRow}>
                          <Text style={[styles.variantName, { color: '#94a3b8' }]}>
                            {v.name} (option · non comptée)
                          </Text>
                          <Text style={[styles.variantPrice, { color: '#94a3b8' }]}>
                            {v.price != null
                              ? fmt(v.price * (1 + item.margin_percent / 100), currency)
                              : '—'}
                          </Text>
                        </View>
                      ))}
                      {hiddenOptions > 0 ? (
                        <Text
                          style={{
                            fontSize: 7.5,
                            color: '#94a3b8',
                            fontFamily: 'Helvetica-Oblique',
                            marginTop: 2,
                          }}
                        >
                          + {hiddenOptions} autre{hiddenOptions > 1 ? 's' : ''} variante
                          {hiddenOptions > 1 ? 's' : ''} disponible
                          {hiddenOptions > 1 ? 's' : ''} sur demande
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, styles.colArea]}>—</Text>
                <Text style={[styles.tableCell, styles.colUnit]}>
                  {fmt(finalPrice, currency)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.colTotalLast,
                    { fontFamily: 'Helvetica-Bold' },
                  ]}
                >
                  {fmt(lineTotal, currency)}
                </Text>
              </View>
            );
          })}

          {/* Sous total FOB */}
          <View style={styles.totalRowFinal} wrap={false}>
            <Text style={[styles.totalLabelCell, styles.colProduct]}>Sous Total FOB</Text>
            <Text style={[styles.tableCell, styles.colQty]}> </Text>
            <Text style={[styles.tableCell, styles.colArea]}> </Text>
            <Text style={[styles.tableCell, styles.colUnit]}> </Text>
            <Text style={[styles.totalValueCell, styles.colTotalLast]}>
              {fmt(itemsTotalCny, currency)}
            </Text>
          </View>

          {/* Transport aérien (masqué si le maritime est retenu) */}
          {showAir && (transport?.airAvailable && transport.airCostCny != null ? (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>
                  Pack Transport Aérien
                </Text>
                <Text style={{ fontSize: 8, color: '#475569' }}>
                  Destination : {destLabel} · Chargement, transport départ,
                  contrôle qualité, douane export, formalités admin Chine
                </Text>
                <Text
                  style={{
                    fontSize: 8,
                    fontFamily: 'Helvetica-Bold',
                    color: '#0f172a',
                    marginTop: 2,
                  }}
                >
                  {transport.hasBattery && (transport.airWeightBattery ?? 0) > 0
                    ? `Poids total : ${transport.totalWeight!.toFixed(2)} kg — ${transport.airWeightStd!.toFixed(2)} kg standard à ${fmtNativeRate(transport.airRatePerKg, transport.nativeCurrency)}/kg + ${transport.airWeightBattery!.toFixed(2)} kg avec batterie à ${fmtNativeRate(transport.airBatteryRatePerKg, transport.nativeCurrency)}/kg`
                    : `Poids total : ${transport.totalWeight!.toFixed(2)} kg (${fmtNativeRate(transport.airRatePerKg, transport.nativeCurrency)}/kg)${taxableNote}`}
                </Text>
                {delay('air') && (
                  <Text style={{ fontSize: 8, color: '#475569', marginTop: 1 }}>Livré à l&apos;adresse · délai porte à porte : {delay('air')}</Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>1</Text>
              <Text style={[styles.tableCell, styles.colArea]}>—</Text>
              <Text style={[styles.tableCell, styles.colUnit]}>
                {fmt(transport.airCostCny, currency)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.colTotalLast,
                  { fontFamily: 'Helvetica-Bold' },
                ]}
              >
                {fmt(transport.airCostCny, currency)}
              </Text>
            </View>
          ) : (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>
                  Pack Transport Aérien
                </Text>
                <Text style={{ fontSize: 8, color: '#94a3b8' }}>
                  À calculer — poids unitaire des produits à confirmer
                </Text>
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>1</Text>
              <Text style={[styles.tableCell, styles.colArea]}>—</Text>
              <Text style={[styles.tableCell, styles.colUnit, { color: '#94a3b8' }]}>—</Text>
              <Text style={[styles.tableCell, styles.colTotalLast, { color: '#94a3b8' }]}>—</Text>
            </View>
          ))}

          {/* Transport maritime (masqué si l'aérien est retenu) */}
          {showSea && (transport?.seaAvailable && transport.seaCostCny != null ? (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>
                  Pack Transport Maritime — {transport.seaModeLabel}
                </Text>
                <Text style={{ fontSize: 8, color: '#475569' }}>
                  Destination : {destLabel} · Chargement, transport départ,
                  contrôle qualité, douane export, formalités admin Chine
                </Text>
                <Text
                  style={{
                    fontSize: 8,
                    fontFamily: 'Helvetica-Bold',
                    color: '#0f172a',
                    marginTop: 2,
                  }}
                >
                  Volume marchandise (CBM) : {transport.totalVolume!.toFixed(4)} m³
                  {transport.seaMode === 'groupage' &&
                    ` (${fmtNativeRate(transport.seaRatePerCbm, transport.nativeCurrency)}/m³)`}
                  {transport.seaMode !== 'groupage' && transport.seaCostNative != null &&
                    ` — forfait : ${fmtNativeAmount(transport.seaFreightNative ?? transport.seaCostNative, transport.seaCostCurrency)}`}
                </Text>
                {transport.seaTruck && (
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 1 }}>
                    + Camion de {transport.seaTruck.from} à {transport.seaTruck.city} : {transport.seaTruck.pallets} palette{transport.seaTruck.pallets > 1 ? 's' : ''} × {fmtNativeAmount(transport.seaTruck.perPallet, transport.nativeCurrency)} = {fmtNativeAmount(transport.seaTruck.costNative, transport.nativeCurrency)}
                  </Text>
                )}
                {delay('sea') && (
                  <Text style={{ fontSize: 8, color: '#475569', marginTop: 1 }}>Délai porte à porte : {delay('sea')}</Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>
                {transport.seaContainerCount > 1 ? transport.seaContainerCount : 1}
              </Text>
              <Text style={[styles.tableCell, styles.colArea]}>—</Text>
              <Text style={[styles.tableCell, styles.colUnit]}>
                {fmt(transport.seaCostCny, currency)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.colTotalLast,
                  { fontFamily: 'Helvetica-Bold' },
                ]}
              >
                {fmt(transport.seaCostCny, currency)}
              </Text>
            </View>
          ) : (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>
                  Pack Transport Maritime
                </Text>
                <Text style={{ fontSize: 8, color: '#94a3b8' }}>
                  À calculer — volume (CBM) des produits à confirmer
                </Text>
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>1</Text>
              <Text style={[styles.tableCell, styles.colArea]}>—</Text>
              <Text style={[styles.tableCell, styles.colUnit, { color: '#94a3b8' }]}>—</Text>
              <Text style={[styles.tableCell, styles.colTotalLast, { color: '#94a3b8' }]}>—</Text>
            </View>
          ))}

          {/* Transport ferroviaire (destinations qui le proposent) */}
          {showTrain && (transport?.trainAvailable && transport.trainCostCny != null ? (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>Pack Transport Ferroviaire</Text>
                <Text style={{ fontSize: 8, color: '#475569' }}>
                  Destination : {destLabel} · Chargement, transport départ,
                  contrôle qualité, douane export, formalités admin Chine · livré à l&apos;adresse
                </Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 }}>
                  {`Poids facturé : ${(transport.chargeableWeight ?? transport.totalWeight ?? 0).toFixed(2)} kg (${fmtNativeAmount(transport.trainRatePerKg ?? 0, transport.nativeCurrency)}/kg)${taxableNote}`}
                </Text>
                {delay('train') && (
                  <Text style={{ fontSize: 8, color: '#475569', marginTop: 1 }}>Délai porte à porte : {delay('train')}</Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>1</Text>
              <Text style={[styles.tableCell, styles.colArea]}>—</Text>
              <Text style={[styles.tableCell, styles.colUnit]}>{fmt(transport.trainCostCny, currency)}</Text>
              <Text style={[styles.tableCell, styles.colTotalLast, { fontFamily: 'Helvetica-Bold' }]}>{fmt(transport.trainCostCny, currency)}</Text>
            </View>
          ) : (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>Pack Transport Ferroviaire</Text>
                <Text style={{ fontSize: 8, color: '#94a3b8' }}>À calculer — poids unitaire des produits à confirmer</Text>
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>1</Text>
              <Text style={[styles.tableCell, styles.colArea]}>—</Text>
              <Text style={[styles.tableCell, styles.colUnit, { color: '#94a3b8' }]}>—</Text>
              <Text style={[styles.tableCell, styles.colTotalLast, { color: '#94a3b8' }]}>—</Text>
            </View>
          ))}

          {/* Separateur noir + total : jamais separes par un saut de page.
              minPresenceAhead reserve la place de la note legale en dessous,
              pour qu elle ne se retrouve jamais seule sur une page. */}
          <View wrap={false} minPresenceAhead={34}>
            <View style={styles.totalRowGrand} />

            {/* Total à payer */}
            <View style={[styles.totalRowFinal, { borderBottomWidth: 0 }]}>
              <Text style={[styles.totalLabelCell, styles.colProduct, { fontSize: 13 }]}>
                Total à Payer
              </Text>
              <Text style={[styles.tableCell, styles.colQty]}> </Text>
              <Text style={[styles.tableCell, styles.colArea]}> </Text>
              <Text style={[styles.tableCell, styles.colUnit]}> </Text>
              <Text style={[styles.totalValueCell, styles.colTotalLast, { fontSize: 13, color: '#0f172a' }]}>
                {fmt(grandTotalCny, currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Legal note */}
        <Text style={styles.legalNote}>
          Le présent devis porte sur une prestation d&apos;une durée de
          <Text style={{ fontFamily: 'Helvetica-Bold' }}> quinze (15) jours</Text>,
          pour un montant global de
          <Text style={{ fontFamily: 'Helvetica-Bold' }}> {fmt(grandTotalCny, currency)}</Text>.
        </Text>

        {/* Footer */}
        <Text style={[styles.footer, { fontFamily: cjk }]} fixed>
          {COMPANY_ADDRESS_LINE}
        </Text>
      </Page>
    </Document>
  );
}
