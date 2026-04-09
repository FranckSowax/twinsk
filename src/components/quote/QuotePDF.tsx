import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2px solid #f59e0b',
  },
  logo: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#f59e0b',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 4,
  },
  devisTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'right',
  },
  devisInfo: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 4,
  },
  clientSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  clientRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  clientLabel: {
    width: 80,
    color: '#64748b',
    fontSize: 9,
  },
  clientValue: {
    flex: 1,
    fontSize: 9,
    color: '#1e293b',
  },
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    padding: 8,
    borderRadius: 4,
  },
  tableHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1px solid #e2e8f0',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  colImage: { width: 40 },
  colProduct: { flex: 1, paddingHorizontal: 8 },
  colPrice: { width: 70, textAlign: 'right' },
  colQty: { width: 40, textAlign: 'center' },
  colMargin: { width: 50, textAlign: 'center' },
  colTotal: { width: 80, textAlign: 'right' },
  productImage: {
    width: 30,
    height: 30,
    borderRadius: 4,
    objectFit: 'cover',
  },
  productTitle: {
    fontSize: 9,
    color: '#1e293b',
  },
  totalSection: {
    alignItems: 'flex-end',
    marginTop: 16,
    paddingTop: 16,
    borderTop: '2px solid #f59e0b',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  totalLabel: {
    width: 120,
    textAlign: 'right',
    fontSize: 10,
    color: '#64748b',
    paddingRight: 12,
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
    fontSize: 10,
    color: '#1e293b',
    fontFamily: 'Helvetica-Bold',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #e2e8f0',
  },
  grandTotalLabel: {
    width: 120,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    paddingRight: 12,
  },
  grandTotalValue: {
    width: 100,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#f59e0b',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 12,
  },
});

interface QuoteItem {
  title: string;
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
  totalAmount: number;
}

function formatCNY(amount: number) {
  return `¥ ${amount.toFixed(2)}`;
}

export default function QuotePDF({
  quoteId,
  quoteDate,
  clientName,
  clientEmail,
  clientPhone,
  items,
  totalAmount,
}: QuotePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>TWINSK</Text>
            <Text style={styles.subtitle}>Logistics & Sourcing Company</Text>
          </View>
          <View>
            <Text style={styles.devisTitle}>DEVIS</Text>
            <Text style={styles.devisInfo}>N° {quoteId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.devisInfo}>Date : {quoteDate}</Text>
          </View>
        </View>

        {/* Client info */}
        <View style={styles.clientSection}>
          <Text style={styles.sectionTitle}>Informations client</Text>
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>Nom :</Text>
            <Text style={styles.clientValue}>{clientName}</Text>
          </View>
          {clientEmail && (
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Email :</Text>
              <Text style={styles.clientValue}>{clientEmail}</Text>
            </View>
          )}
          {clientPhone && (
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Téléphone :</Text>
              <Text style={styles.clientValue}>{clientPhone}</Text>
            </View>
          )}
        </View>

        {/* Table */}
        <View style={styles.table}>
          <Text style={styles.sectionTitle}>Détail des produits</Text>

          {/* Header row */}
          <View style={styles.tableHeader}>
            <View style={styles.colImage} />
            <Text style={[styles.tableHeaderText, styles.colProduct]}>Produit</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>Prix unit.</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qté</Text>
            <Text style={[styles.tableHeaderText, styles.colMargin]}>Marge</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
          </View>

          {/* Data rows */}
          {items.map((item, index) => {
            const finalPrice = item.price * (1 + item.margin_percent / 100);
            const lineTotal = finalPrice * item.quantity;

            return (
              <View
                key={index}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <View style={styles.colImage}>
                  {item.image_url ? (
                    <Image src={item.image_url} style={styles.productImage} />
                  ) : null}
                </View>
                <Text style={[styles.productTitle, styles.colProduct]}>
                  {item.title.length > 60 ? item.title.slice(0, 60) + '...' : item.title}
                </Text>
                <Text style={[{ fontSize: 9 }, styles.colPrice]}>
                  {formatCNY(finalPrice)}
                </Text>
                <Text style={[{ fontSize: 9 }, styles.colQty]}>{item.quantity}</Text>
                <Text style={[{ fontSize: 9 }, styles.colMargin]}>
                  {item.margin_percent}%
                </Text>
                <Text style={[{ fontSize: 9, fontFamily: 'Helvetica-Bold' }, styles.colTotal]}>
                  {formatCNY(lineTotal)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Nombre de produits :</Text>
            <Text style={styles.totalValue}>{items.length}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>TOTAL :</Text>
            <Text style={styles.grandTotalValue}>{formatCNY(totalAmount)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          TWINSK Company — Logistics & Sourcing • Ce devis est valable 30 jours
        </Text>
      </Page>
    </Document>
  );
}
