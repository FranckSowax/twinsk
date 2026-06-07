import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import {
  type CurrencyCode,
  formatInCurrency,
} from '@/lib/utils/formatCurrency';
import type { QuoteTransportSummary } from '@/lib/quote-transport';

const COMPANY_ADDRESS_LINE =
  'Twinsk Company Limited — Room 506, Tongyue Building, No. 7 Tongya East Street, Xicha Road, Baiyun District, Guangzhou — 广州市白云区西槎路同雅东街7号同粤大厦506 — 邓小姐 +86 13710816769 — contact@twinskcompanyltd.com';

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },

  // Header (logo left, client info right)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  logoBlock: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  logoImage: {
    width: 120,
    height: 120,
    objectFit: 'contain',
  },
  logoText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    letterSpacing: 2,
  },
  logoSubText: {
    fontSize: 6,
    color: '#475569',
    marginTop: 2,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  logoLine: {
    width: 60,
    height: 1,
    backgroundColor: '#0f172a',
    marginVertical: 4,
  },
  logoSubText2: {
    fontSize: 6,
    color: '#475569',
    letterSpacing: 1,
    textAlign: 'center',
  },
  clientHeader: {
    alignItems: 'center',
    flex: 1,
    paddingLeft: 30,
    paddingTop: 20,
  },
  clientName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  clientCity: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },

  // Meta block (Date + Invoice n°)
  metaBlock: {
    marginBottom: 8,
  },
  metaLine: {
    fontSize: 10,
    color: '#0f172a',
  },
  metaLineBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },

  // Twinsk company info block
  twinskInfo: {
    marginBottom: 18,
  },
  twinskInfoLine: {
    fontSize: 9,
    color: '#1e293b',
    marginBottom: 2,
  },

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
    padding: 8,
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
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    textAlign: 'center',
    justifyContent: 'center',
  },
  productCell: {
    fontSize: 9,
    color: '#1e293b',
    padding: 8,
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
    width: 50,
    height: 50,
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
    marginTop: 16,
    marginBottom: 16,
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

interface QuoteItem {
  title: string;
  description?: string | null;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
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
  logoUrl,
}: QuotePDFProps) {
  // Compute totals
  const itemsTotalCny = items.reduce(
    (sum, it) => sum + it.price * (1 + it.margin_percent / 100) * it.quantity,
    0,
  );

  // Couts transport dans la devise du devis (CNY). On affiche les 2 modes ;
  // le "Total a payer" prend le moins cher disponible (cas B2B le plus courant).
  const transportAirCny = transport?.airAvailable ? transport.airCostCny : null;
  const transportSeaCny = transport?.seaAvailable ? transport.seaCostCny : null;
  let finalTransportCny: number | null = null;
  if (transportAirCny != null && transportSeaCny != null) {
    finalTransportCny = Math.min(transportAirCny, transportSeaCny);
  } else if (transportAirCny != null) {
    finalTransportCny = transportAirCny;
  } else if (transportSeaCny != null) {
    finalTransportCny = transportSeaCny;
  }
  const grandTotalCny = itemsTotalCny + (finalTransportCny ?? 0);
  const hub = transport?.hub || 'LBV';
  const destLabel = transport?.destinationLabel || 'Gabon (Libreville)';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header : logo + client */}
        <View style={styles.header}>
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
          <View style={styles.clientHeader}>
            <Text style={styles.clientName}>{clientName}</Text>
            <Text style={styles.clientCity}>
              {clientEmail || clientPhone || 'Client Twinsk'}
            </Text>
          </View>
        </View>

        {/* Meta : Date + Invoice */}
        <View style={styles.metaBlock}>
          <Text style={styles.metaLine}>Date : {quoteDate}</Text>
          <Text style={styles.metaLineBold}>
            INVOICE N° : TWK{quoteId.slice(0, 8).toUpperCase()}
          </Text>
        </View>

        {/* Twinsk company info */}
        <View style={styles.twinskInfo}>
          <Text style={styles.twinskInfoLine}>
            Room 506, Tongyue Building, No. 7 Tongya East Street,
          </Text>
          <Text style={styles.twinskInfoLine}>
            Xicha Road, Baiyun District, Guangzhou
          </Text>
          <Text style={styles.twinskInfoLine}>广州市白云区西槎路同雅东街7号同粤大厦506</Text>
          <Text style={styles.twinskInfoLine}>邓小姐 13710816769</Text>
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
          {items.map((item, index) => {
            const finalPrice = item.price * (1 + item.margin_percent / 100);
            const lineTotal = finalPrice * item.quantity;
            return (
              <View key={index} style={styles.tableRow} wrap={false}>
                <View style={[styles.productCell, styles.colProduct]}>
                  {item.image_url ? (
                    <Image src={item.image_url} style={styles.productImage} />
                  ) : null}
                  <Text style={styles.productTitleBold}>{item.title}</Text>
                  {item.description ? (
                    <Text style={{ fontSize: 8, color: '#475569' }}>
                      {item.description.length > 280
                        ? item.description.slice(0, 280) + '…'
                        : item.description}
                    </Text>
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

          {/* Transport aérien */}
          {transport?.airAvailable && transport.airCostCny != null ? (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>
                  Pack Transport Aérien {hub}
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
                  Poids total : {transport.totalWeight!.toFixed(2)} kg ({fmtNativeRate(transport.airRatePerKg, transport.nativeCurrency)}/kg{transport.hasBattery ? ' · avec batterie' : ''})
                </Text>
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
                  Pack Transport Aérien {hub}
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
          )}

          {/* Transport maritime */}
          {transport?.seaAvailable && transport.seaCostCny != null ? (
            <View style={styles.totalRowFinal} wrap={false}>
              <View style={[styles.productCell, styles.colProduct]}>
                <Text style={styles.productTitleBold}>
                  Pack Transport Maritime {hub} (groupage)
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
                  Volume marchandise (CBM) : {transport.totalVolume!.toFixed(4)} m³ ({fmtNativeRate(transport.seaRatePerCbm, transport.nativeCurrency)}/m³)
                </Text>
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>1</Text>
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
                  Pack Transport Maritime {hub} (groupage)
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
          )}

          {/* Black separator */}
          <View style={styles.totalRowGrand} />

          {/* Total à payer */}
          <View style={[styles.totalRowFinal, { borderBottomWidth: 0 }]} wrap={false}>
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

        {/* Legal note */}
        <Text style={styles.legalNote}>
          Le présent devis porte sur une prestation d&apos;une durée de
          <Text style={{ fontFamily: 'Helvetica-Bold' }}> quinze (15) jours</Text>,
          pour un montant global de
          <Text style={{ fontFamily: 'Helvetica-Bold' }}> {fmt(grandTotalCny, currency)}</Text>.
        </Text>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          {COMPANY_ADDRESS_LINE}
        </Text>
      </Page>
    </Document>
  );
}
