// PDF du devis consolidé d'un projet (react-pdf, gabarit des devis Twinsk) :
// lignes par lot, quantités retenues, statut de validation, trois totaux et
// la mention de confidentialité. Jamais de nom d'usine ni de prix d'achat :
// il est construit depuis la projection publique.
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PublicProject } from '@/lib/projects/public';
import { groupByLot } from '@/lib/projects/logic';

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  logo: { width: 110, height: 40, objectFit: 'contain' },
  h1: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#64748b' },
  lot: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4, color: '#065f46' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 4 },
  head: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#0f172a', paddingBottom: 3, fontFamily: 'Helvetica-Bold' },
  cLabel: { flex: 4 },
  cQty: { flex: 1.3, textAlign: 'right' },
  cUnit: { flex: 1.3, textAlign: 'right' },
  cTotal: { flex: 1.5, textAlign: 'right' },
  cStatus: { flex: 1.4, textAlign: 'right', color: '#475569' },
  totals: { marginTop: 16, alignSelf: 'flex-end', width: 260 },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  disclaimer: { marginTop: 22, fontSize: 8, color: '#64748b', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 7, color: '#94a3b8', textAlign: 'center' },
});

const fmt = (n: number | null, cur: string) => (n == null ? 'à chiffrer' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n));
const STATUS: Record<string, string> = { draft: 'à valider', validated: 'validée', ordered: 'commandée' };

export default function ProjectQuotePDF({ p, logoUrl, date, clientName }: { p: PublicProject; logoUrl: string | null; date: string; clientName: string }) {
  const cur = p.currency;
  const lines = p.quote.lines.filter((l) => !(l.optional && !l.enabled));
  return (
    <Document title={`Devis — ${p.title}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.h1}>Devis consolidé</Text>
            <Text style={s.muted}>{p.title}</Text>
            <Text style={s.muted}>Client : {clientName} · Édité le {date}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf : pas d’attribut alt */}
          {logoUrl ? <Image src={logoUrl} style={s.logo} /> : null}
        </View>
        {groupByLot(lines).map((g) => (
          <View key={g.lot} wrap={false}>
            <Text style={s.lot}>{g.lot}</Text>
            <View style={s.head}>
              <Text style={s.cLabel}>Désignation</Text><Text style={s.cQty}>Quantité</Text><Text style={s.cUnit}>Prix unitaire</Text><Text style={s.cTotal}>Total</Text><Text style={s.cStatus}>Statut</Text>
            </View>
            {g.lines.map((l) => (
              <View key={l.id} style={s.row}>
                <Text style={s.cLabel}>{l.label}{l.optional ? ' (option)' : ''}{l.supplier_alias ? ` — ${l.supplier_alias}` : ''}</Text>
                <Text style={s.cQty}>{l.effective_quantity} {l.unit}</Text>
                <Text style={s.cUnit}>{fmt(l.unit_price, cur)}{l.entered_price != null && l.price_currency !== cur ? ` (${fmt(l.entered_price, l.price_currency)})` : ''}</Text>
                <Text style={s.cTotal}>{fmt(l.total, cur)}</Text>
                <Text style={s.cStatus}>{STATUS[l.status] || l.status}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={s.totals}>
          <View style={s.tRow}><Text>Validé ou commandé</Text><Text>{fmt(p.quote.totals.committed, cur)}</Text></View>
          <View style={s.tRow}><Text>En attente de validation</Text><Text>{fmt(p.quote.totals.pending, cur)}</Text></View>
          <View style={[s.tRow, { borderTopWidth: 1, borderTopColor: '#0f172a', fontFamily: 'Helvetica-Bold' }]}><Text>Programme estimé</Text><Text>{fmt(p.quote.totals.estimated, cur)}</Text></View>
          {p.quote.totals.unpriced > 0 ? <Text style={[s.muted, { fontSize: 8 }]}>{p.quote.totals.unpriced} ligne(s) restant à chiffrer.</Text> : null}
          {Object.keys(p.rates).length > 0 ? <Text style={[s.muted, { fontSize: 8 }]}>Taux appliqués : {Object.entries(p.rates).map(([c, v]) => `1 ${c} = ${v} ${cur}`).join(' · ')}</Text> : null}
        </View>
        <Text style={s.disclaimer}>{p.disclaimer}</Text>
        <Text style={s.footer} fixed>Les quantités retenues sont celles indiquées par le client ; une ligne validée est figée à la date de sa validation.</Text>
      </Page>
    </Document>
  );
}
