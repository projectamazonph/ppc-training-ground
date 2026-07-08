/**
 * Receipt PDF — rendered server-side via @react-pdf/renderer.
 *
 * Sprint 6 — STORY-029.
 *
 * BIR-formatted official receipt. Layout follows Philippine BIR receipt
 * conventions: header with business name + TIN, sequential receipt number
 * (BS #####-YYYY format), date, buyer name + TIN (optional), line items
 * with VAT breakdown, totals.
 *
 * Numbers formatted using the standard en-PH currency formatter. Layout
 * is monochrome (black on cream) to keep the file small and look clean
 * when printed.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FAFAF7',
    padding: 48,
    fontFamily: 'Helvetica',
    color: '#1A1A2E',
    fontSize: 10,
  },
  // ---- Header ----
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
    paddingBottom: 12,
    marginBottom: 16,
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  businessMeta: {
    fontSize: 9,
    textAlign: 'center',
    color: '#5A5A6E',
    marginBottom: 1,
  },
  receiptTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 1,
  },
  // ---- Meta block (receipt number, date, buyer) ----
  metaBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    color: '#5A5A6E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    color: '#1A1A2E',
    marginBottom: 8,
  },
  // ---- Line items ----
  lineTable: {
    marginBottom: 12,
  },
  lineHeader: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1A2E',
    paddingBottom: 4,
    marginBottom: 4,
  },
  lineHeaderCell: {
    fontSize: 8,
    color: '#5A5A6E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  cellDescription: { flex: 4 },
  cellQty: { flex: 1, textAlign: 'right' },
  cellUnit: { flex: 1.5, textAlign: 'right' },
  cellTotal: { flex: 1.5, textAlign: 'right' },
  // ---- Totals ----
  totalsBlock: {
    marginTop: 8,
    alignSelf: 'flex-end',
    width: 240,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 10,
    color: '#5A5A6E',
  },
  totalsValue: {
    fontSize: 10,
    color: '#1A1A2E',
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
    marginTop: 4,
    paddingTop: 6,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  // ---- Footer ----
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#1A1A2E',
  },
  footerNote: {
    fontSize: 8,
    color: '#5A5A6E',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  footerSmall: {
    fontSize: 7,
    color: '#5A5A6E',
    textAlign: 'center',
  },
});

export interface ReceiptData {
  // Business (seller) info
  businessName: string;
  businessTin: string;
  businessAddress: string;
  // Receipt identification
  receiptNumber: string; // formatted as "BS 00001-2026"
  issuedAt: Date;
  // Buyer (customer) info
  buyerName: string;
  buyerEmail: string;
  buyerTin?: string | null;
  // Line items
  description: string;
  quantity: number;
  unitPriceCentavos: number; // for display formatting
  // Totals (all in centavos for arithmetic safety)
  grossAmountCentavos: number;
  vatAmountCentavos: number;
  netAmountCentavos: number;
  // Payment metadata
  paymentMethod: string;
  paymentReference: string; // PayMongo payment id
}

function formatCentavos(centavos: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}

function formatDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  return (
    <Document
      title={`Official Receipt ${data.receiptNumber}`}
      author={data.businessName}
    >
      <Page size="A4" style={styles.page}>
        {/* ---- Header ---- */}
        <View style={styles.header}>
          <Text style={styles.businessName}>{data.businessName}</Text>
          <Text style={styles.businessMeta}>TIN: {data.businessTin}</Text>
          <Text style={styles.businessMeta}>{data.businessAddress}</Text>
          <Text style={styles.receiptTitle}>OFFICIAL RECEIPT</Text>
        </View>

        {/* ---- Meta block ---- */}
        <View style={styles.metaBlock}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Receipt No.</Text>
            <Text style={styles.metaValue}>{data.receiptNumber}</Text>
            <Text style={styles.metaLabel}>Date Issued</Text>
            <Text style={styles.metaValue}>{formatDateOnly(data.issuedAt)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Billed To</Text>
            <Text style={styles.metaValue}>{data.buyerName}</Text>
            <Text style={styles.metaLabel}>Email</Text>
            <Text style={styles.metaValue}>{data.buyerEmail}</Text>
            {data.buyerTin && (
              <>
                <Text style={styles.metaLabel}>Buyer TIN</Text>
                <Text style={styles.metaValue}>{data.buyerTin}</Text>
              </>
            )}
          </View>
        </View>

        {/* ---- Line items ---- */}
        <View style={styles.lineTable}>
          <View style={styles.lineHeader}>
            <Text style={[styles.lineHeaderCell, styles.cellDescription]}>
              Description
            </Text>
            <Text style={[styles.lineHeaderCell, styles.cellQty]}>Qty</Text>
            <Text style={[styles.lineHeaderCell, styles.cellUnit]}>
              Unit Price
            </Text>
            <Text style={[styles.lineHeaderCell, styles.cellTotal]}>
              Amount
            </Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.cellDescription}>{data.description}</Text>
            <Text style={styles.cellQty}>{data.quantity}</Text>
            <Text style={styles.cellUnit}>
              {formatCentavos(data.unitPriceCentavos)}
            </Text>
            <Text style={styles.cellTotal}>
              {formatCentavos(data.grossAmountCentavos)}
            </Text>
          </View>
        </View>

        {/* ---- Totals (VAT breakdown) ---- */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Net of VAT</Text>
            <Text style={styles.totalsValue}>
              {formatCentavos(data.netAmountCentavos)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>VAT (12%)</Text>
            <Text style={styles.totalsValue}>
              {formatCentavos(data.vatAmountCentavos)}
            </Text>
          </View>
          <View style={[styles.totalsRow, styles.grandTotal]}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>
              {formatCentavos(data.grossAmountCentavos)}
            </Text>
          </View>
        </View>

        {/* ---- Footer ---- */}
        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            This is a system-generated official receipt. No signature required.
          </Text>
          <Text style={styles.footerSmall}>
            Payment method: {data.paymentMethod} · Reference: {data.paymentReference}
          </Text>
          <Text style={styles.footerSmall}>
            Keep this receipt for your records. For refund requests, contact us
            within 7 days of purchase.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
