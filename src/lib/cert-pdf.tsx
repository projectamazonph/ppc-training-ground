/**
 * Certificate PDF — rendered server-side via @react-pdf/renderer.
 *
 * Layout: monochrome, one page. Looks clean when printed or downloaded.
 * Public — anyone with the verification hash can render it.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { BRAND_NAME, BRAND_NAME_UPPER, BRAND_CERT_PREFIX } from '@/lib/brand';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FAFAF7',
    padding: 56,
    fontFamily: 'Helvetica',
    color: '#1A1A2E',
  },
  outerBorder: {
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#1A1A2E',
    padding: 32,
    flex: 1,
  },
  innerBorder: {
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: '#1A1A2E',
    padding: 28,
    flex: 1,
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 6,
    textAlign: 'center',
    color: '#5A5A6E',
  },
  title: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    color: '#3A3A4E',
    marginBottom: 36,
  },
  presentedTo: {
    fontSize: 10,
    letterSpacing: 3,
    textAlign: 'center',
    color: '#5A5A6E',
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#1A1A2E',
    marginBottom: 18,
  },
  divider: {
    borderTopWidth: 0.5,
    borderColor: '#1A1A2E',
    width: 160,
    alignSelf: 'center',
    marginBottom: 18,
  },
  completionStatement: {
    fontSize: 11,
    textAlign: 'center',
    color: '#3A3A4E',
    lineHeight: 1.6,
    paddingHorizontal: 32,
    marginBottom: 18,
  },
  courseTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  courseMeta: {
    fontSize: 10,
    textAlign: 'center',
    color: '#5A5A6E',
    marginBottom: 32,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  footerCol: {
    flex: 1,
    paddingHorizontal: 12,
  },
  signatureLine: {
    borderTopWidth: 0.5,
    borderColor: '#1A1A2E',
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#5A5A6E',
    textAlign: 'center',
    letterSpacing: 1,
  },
  signatureName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  certificateNumberLabel: {
    fontSize: 8,
    color: '#5A5A6E',
    marginBottom: 2,
    letterSpacing: 1,
  },
  certificateNumber: {
    fontSize: 9,
    color: '#1A1A2E',
    fontFamily: 'Courier',
  },
  verifyLabel: {
    fontSize: 8,
    color: '#5A5A6E',
    marginTop: 4,
    letterSpacing: 1,
  },
  verifyHash: {
    fontSize: 8,
    color: '#1A1A2E',
    fontFamily: 'Courier',
    marginTop: 2,
  },
  issuedDate: {
    fontSize: 8,
    color: '#5A5A6E',
    marginTop: 2,
  },
});

export interface CertificatePdfProps {
  recipientName: string;
  courseTitle: string;
  courseHours: number;
  issuedAt: Date;
  verificationHash: string;
  verificationUrl: string;
}

export function CertificatePdf(props: CertificatePdfProps) {
  const issuedFormatted = props.issuedAt.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Short reference number — first 8 hex chars of the verification hash.
  // Display-only. The full hash remains the canonical verification id.
  const refNumber = props.verificationHash.replace(/-/g, '').slice(0, 8).toUpperCase();

  return (
    <Document
      title={`Certificate - ${props.recipientName} - ${props.courseTitle}`}
      author={BRAND_NAME}
      subject="Certificate of Completion"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder}>
            <View>
              <Text style={styles.eyebrow}>{BRAND_NAME_UPPER}</Text>
              <Text style={styles.title}>Certificate of Completion</Text>
              <Text style={styles.subtitle}>Amazon PPC Mastery for Filipino Virtual Assistants</Text>

              <Text style={styles.presentedTo}>PRESENTED TO</Text>
              <Text style={styles.recipientName}>{props.recipientName}</Text>
              <View style={styles.divider} />

              <Text style={styles.completionStatement}>
                For successfully completing every lesson, quiz, and graded tool session in the course:
              </Text>
              <Text style={styles.courseTitle}>{props.courseTitle}</Text>
              <Text style={styles.courseMeta}>
                Estimated {props.courseHours} hours of self-paced study
              </Text>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.footerCol}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>Ryan Dabao</Text>
                <Text style={styles.signatureLabel}>FOUNDER &amp; LEAD INSTRUCTOR</Text>
              </View>

              <View style={styles.footerCol}>
                <Text style={styles.certificateNumberLabel}>CERTIFICATE NO.</Text>
                <Text style={styles.certificateNumber}>{`${BRAND_CERT_PREFIX}-${refNumber}`}</Text>
                <Text style={styles.issuedDate}>Issued {issuedFormatted}</Text>
                <Text style={styles.verifyLabel}>VERIFY AT</Text>
                <Text style={styles.verifyHash}>{props.verificationUrl}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default CertificatePdf;
