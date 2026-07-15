/**
 * Invoice / receipt business logic + persistence.
 *
 * Sprint 6 — STORY-029.
 *
 * Numbers and amounts:
 *   - Invoice.number is stored as "<year>-<5-digit sequence>" ("2026-00001").
 *     Displayed as "BS 00001-2026". Legacy rows may use the old dashless
 *     format ("000012026") — the PDF renderer parses both.
 *   - ALL money fields store CENTAVOS (Payment.amountPhp included — the
 *     `*Php` names are historical; see docs/security/code-audit-2026-07-15.md).
 *   - VAT: standard Philippine VAT-inclusive pricing. For a gross of
 *     X, net = X / 1.12, vat = X - net. Rounded to nearest centavo.
 *
 * Storage:
 *   - PDFs render server-side into the OS temp dir (writable on Vercel,
 *     ephemeral — the authed route re-renders on cache miss). They must
 *     NEVER go under `public/`: that serves BIR receipts (name + email)
 *     statically with no auth, and the bundle FS is read-only on Vercel.
 *   - This is the SWAP POINT for durable storage — replace the fs write
 *     with a private Vercel Blob upload. The data shape stays the same.
 */

import 'server-only';

import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from './db';
import { ReceiptDocument, type ReceiptData } from './receipt-pdf';

export const RECEIPTS_DIR = path.join(os.tmpdir(), 'amph-receipts');

/**
 * Build the receipt number for a given year + 5-digit sequence.
 * Format: "BS 00001-2026" — used for display only.
 */
export function formatReceiptNumber(sequence: number, year: number): string {
  return `BS ${String(sequence).padStart(5, '0')}-${year}`;
}

/**
 * Find the next available sequence number for invoices issued in a given
 * calendar year. Looks at the highest stored number with the "<year>-"
 * prefix and adds 1; starts at 1 when the year has no invoices yet.
 * Zero-padding makes lexicographic `orderBy: desc` equal numeric ordering.
 */
export async function nextInvoiceSequence(year: number): Promise<number> {
  const prefix = `${year}-`;
  const latest = await db.invoice.findFirst({
    where: {
      deletedAt: null,
      number: { startsWith: prefix },
    },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  if (!latest) return 1;
  const seq = parseInt(latest.number.split('-')[1] ?? '', 10);
  return Number.isFinite(seq) ? seq + 1 : 1;
}

/**
 * Build an Invoice record for a completed Payment. Computes the
 * sequential number, splits gross → net + VAT, and persists the row.
 * Returns the invoice id; pdf generation is a separate step.
 *
 * Idempotent: if an invoice already exists for this payment, returns
 * the existing one without re-numbering.
 */
export async function issueInvoiceForPayment(
  paymentId: string,
): Promise<{ id: string; number: string; isNew: boolean }> {
  const existing = await db.invoice.findUnique({
    where: { paymentId },
    select: { id: true, number: true },
  });
  if (existing) {
    return { id: existing.id, number: existing.number, isNew: false };
  }

  const payment = await db.payment.findUnique({
    where: { id: paymentId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      amountPhp: true,
      method: true,
      paymongoPaymentId: true,
      paidAt: true,
    },
  });
  if (!payment) throw new Error(`Payment ${paymentId} not found`);

  const issuedAt = payment.paidAt ?? new Date();
  const year = issuedAt.getUTCFullYear();

  // VAT split (inclusive pricing: gross = net + vat, where vat = 12% of net).
  // payment.amountPhp already stores centavos.
  const grossCentavos = payment.amountPhp;
  const netCentavos = Math.round(grossCentavos / 1.12);
  const vatCentavos = grossCentavos - netCentavos;

  // Sequence + create with retry: two concurrent payments can compute the
  // same sequence; the @unique constraint on `number` rejects the loser,
  // which recomputes and tries again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const sequence = await nextInvoiceSequence(year);
    const number = `${year}-${String(sequence).padStart(5, '0')}`;
    try {
      const invoice = await db.invoice.create({
        data: {
          number,
          paymentId: payment.id,
          userId: payment.userId,
          grossAmountCentavos: grossCentavos,
          vatAmountCentavos: vatCentavos,
          netAmountCentavos: netCentavos,
          issuedAt,
        },
        select: { id: true, number: true },
      });
      return { id: invoice.id, number: invoice.number, isNew: true };
    } catch (e) {
      const isUniqueViolation =
        e instanceof Error && 'code' in e && (e as { code?: string }).code === 'P2002';
      if (!isUniqueViolation || attempt === 2) throw e;
    }
  }
  // Unreachable — the loop either returns or throws.
  throw new Error(`Failed to issue invoice for payment ${paymentId}`);
}

/**
 * Render the PDF for an invoice and write it to local storage. Updates
 * Invoice.pdfUrl with the relative path. Returns the public URL path
 * the user can hit to download the file.
 *
 * Storage SWAP POINT: this is where you'd call `@vercel/blob` upload
 * instead of writing to `public/receipts/`. The data shape returned
 * (relative URL) stays the same.
 */
export async function renderInvoicePdf(
  invoiceId: string,
): Promise<{ pdfPath: string; receiptNumber: string }> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId, deletedAt: null },
    select: {
      id: true,
      number: true,
      issuedAt: true,
      businessName: true,
      businessTin: true,
      businessAddress: true,
      grossAmountCentavos: true,
      vatAmountCentavos: true,
      netAmountCentavos: true,
      payment: {
        select: {
          amountPhp: true,
          method: true,
          paymongoPaymentId: true,
          user: { select: { id: true, email: true, name: true } },
          pricingTier: { select: { name: true, tier: true } },
        },
      },
    },
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  // Build the display number. Canonical format is "2026-00001"; legacy
  // rows use the dashless "000012026" (5-digit seq + 4-digit year).
  const [year, seq] = invoice.number.includes('-')
    ? invoice.number.split('-')
    : [invoice.number.slice(-4), invoice.number.slice(0, 5)];
  const receiptNumber = `BS ${seq}-${year}`;

  const data: ReceiptData = {
    businessName: invoice.businessName,
    businessTin: invoice.businessTin,
    businessAddress: invoice.businessAddress,
    receiptNumber,
    issuedAt: invoice.issuedAt,
    buyerName: invoice.payment.user.name ?? invoice.payment.user.email,
    buyerEmail: invoice.payment.user.email,
    buyerTin: null,
    description: `${invoice.payment.pricingTier.name} enrollment`,
    quantity: 1,
    unitPriceCentavos: invoice.grossAmountCentavos,
    grossAmountCentavos: invoice.grossAmountCentavos,
    vatAmountCentavos: invoice.vatAmountCentavos,
    netAmountCentavos: invoice.netAmountCentavos,
    paymentMethod: invoice.payment.method,
    paymentReference: invoice.payment.paymongoPaymentId ?? '—',
  };

  const buffer = await renderToBuffer(<ReceiptDocument data={data} />);
  const fileName = `${invoice.id}.pdf`;
  const absPath = path.join(RECEIPTS_DIR, fileName);
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
  await fs.writeFile(absPath, buffer);

  // The only download path is the authed, owner-checked API route.
  const pdfUrl = `/api/invoices/${invoice.id}/pdf`;
  await db.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl },
  });

  return { pdfPath: pdfUrl, receiptNumber };
}

/**
 * Get the invoice for a given payment. Returns null if none issued yet.
 */
export async function getInvoiceForPayment(paymentId: string) {
  return db.invoice.findUnique({
    where: { paymentId },
    select: {
      id: true,
      number: true,
      pdfUrl: true,
      issuedAt: true,
      grossAmountCentavos: true,
    },
  });
}

/**
 * Get the invoice (with owner check) for the API route. Returns null
 * if the invoice doesn't exist OR doesn't belong to the given user.
 */
export async function getInvoiceForUser(invoiceId: string, userId: string) {
  return db.invoice.findFirst({
    where: { id: invoiceId, userId, deletedAt: null },
    select: {
      id: true,
      number: true,
      pdfUrl: true,
      issuedAt: true,
      payment: {
        select: { amountPhp: true, method: true, user: { select: { email: true } } },
      },
    },
  });
}
