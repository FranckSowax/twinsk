import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '2px solid #f59e0b',
  },
  logo: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#f59e0b', letterSpacing: 3 },
  subtitle: { fontSize: 8, color: '#64748b', marginTop: 4 },
  docTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right' },
  docInfo: { fontSize: 9, color: '#64748b', textAlign: 'right', marginTop: 4 },
  clientSection: { marginBottom: 20, padding: 14, backgroundColor: '#f8fafc', borderRadius: 6 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 6 },
  clientRow: { flexDirection: 'row', marginBottom: 3 },
  clientLabel: { width: 80, color: '#64748b', fontSize: 8 },
  clientValue: { flex: 1, fontSize: 8, color: '#1e293b' },
  table: { marginBottom: 18 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    padding: 6,
    borderRadius: 3,
  },
  tableHeaderText: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#ffffff', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '1px solid #e2e8f0',
    alignItems: 'center',
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  colNum: { width: 22, textAlign: 'center' },
  colImage: { width: 32 },
  colProduct: { flex: 1, paddingHorizontal: 4 },
  colNumeric: { width: 50, textAlign: 'center' },
  colDim: { width: 70, textAlign: 'center' },
  productImage: { width: 26, height: 26, borderRadius: 3, objectFit: 'cover' },
  productTitle: { fontSize: 8, color: '#1e293b' },
  totalSection: { alignItems: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '2px solid #f59e0b' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  totalLabel: { width: 140, textAlign: 'right', fontSize: 9, color: '#64748b', paddingRight: 10 },
  totalValue: { width: 90, textAlign: 'right', fontSize: 9, color: '#1e293b', fontFamily: 'Helvetica-Bold' },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px solid #e2e8f0',
  },
  grandTotalLabel: {
    width: 140,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    paddingRight: 10,
  },
  grandTotalValue: {
    width: 90,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#f59e0b',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 8,
  },
});

interface PackingItem {
  title: string;
  image_url: string;
  moq: number | null;
  quantity: number;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
}

interface PackingListPDFProps {
  quoteId: string;
  quoteDate: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  items: PackingItem[];
}

export default function PackingListPDF({
  quoteId,
  quoteDate,
  clientName,
  clientEmail,
  clientPhone,
  items,
}: PackingListPDFProps) {
  const totalWeight = items.reduce((sum, i) => sum + (i.weight || 0) * i.quantity, 0);
  const totalVolume = items.reduce((sum, i) => sum + (i.volume || 0) * i.quantity, 0);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

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
            <Text style={styles.docTitle}>PACKING LIST</Text>
            <Text style={styles.docInfo}>N° {quoteId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.docInfo}>Date : {quoteDate}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientSection}>
          <Text style={styles.sectionTitle}>Destinataire</Text>
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>Nom :</Text>
            <Text style={styles.clientValue}>{clientName}</Text>
          </View>
          {clientEmail ? (
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Email :</Text>
              <Text style={styles.clientValue}>{clientEmail}</Text>
            </View>
          ) : null}
          {clientPhone ? (
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>Téléphone :</Text>
              <Text style={styles.clientValue}>{clientPhone}</Text>
            </View>
          ) : null}
        </View>

        {/* Table */}
        <View style={styles.table}>
          <Text style={styles.sectionTitle}>Détail du colisage</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colNum]}>#</Text>
            <View style={styles.colImage} />
            <Text style={[styles.tableHeaderText, styles.colProduct]}>Produit</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>MOQ</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Qté</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Poids/u</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Total kg</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Vol/u</Text>
            <Text style={[styles.tableHeaderText, styles.colDim]}>Dimensions</Text>
          </View>

          {items.map((item, index) => {
            const lineWeight = (item.weight || 0) * item.quantity;
            return (
              <View
                key={index}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[{ fontSize: 8 }, styles.colNum]}>{index + 1}</Text>
                <View style={styles.colImage}>
                  {item.image_url ? <Image src={item.image_url} style={styles.productImage} /> : null}
                </View>
                <Text style={[styles.productTitle, styles.colProduct]}>
                  {item.title.length > 50 ? item.title.slice(0, 50) + '…' : item.title}
                </Text>
                <Text style={[{ fontSize: 8 }, styles.colNumeric]}>
                  {item.moq != null ? item.moq : '—'}
                </Text>
                <Text style={[{ fontSize: 8 }, styles.colNumeric]}>{item.quantity}</Text>
                <Text style={[{ fontSize: 8 }, styles.colNumeric]}>
                  {item.weight != null ? item.weight.toFixed(3) : '—'}
                </Text>
                <Text style={[{ fontSize: 8, fontFamily: 'Helvetica-Bold' }, styles.colNumeric]}>
                  {lineWeight ? lineWeight.toFixed(3) : '—'}
                </Text>
                <Text style={[{ fontSize: 8 }, styles.colNumeric]}>
                  {item.volume != null ? item.volume.toFixed(4) : '—'}
                </Text>
                <Text style={[{ fontSize: 8 }, styles.colDim]}>{item.dimensions || '—'}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Nombre de produits :</Text>
            <Text style={styles.totalValue}>{items.length}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total unités :</Text>
            <Text style={styles.totalValue}>{totalUnits}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Volume total (m³) :</Text>
            <Text style={styles.totalValue}>{totalVolume.toFixed(4)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>POIDS TOTAL :</Text>
            <Text style={styles.grandTotalValue}>{totalWeight.toFixed(3)} kg</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          TWINSK Company — Logistics & Sourcing • Document de colisage à valeur informative
        </Text>
      </Page>
    </Document>
  );
}
