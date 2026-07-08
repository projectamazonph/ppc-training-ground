/**
 * Invoice / receipt business logic + persistence.
 *
 * Sprint 6 — STORY-029.
 *
 * Numbers and amounts:
 *   - Invoice.number is a zero-padded 5-digit string ("00001"). Displayed
 *     as "BS 00001-2026" (where 2026 is the year issued). The display
 *     format is a presentation concern; storage is the raw zero-pad.
 *   - Amounts on Invoice are in CENTAVOS (per schema comment) — different
 *     from Payment.amountPhp which is whole PHP. The conversion happens
 *     in `issueInvoiceForPayment`.
 *   - VAT: standard Philippine VAT-inclusive pricing. For a gross of
 *     X pesos, net = X / 1.12, vat = X - net. Rounded to nearest centavo.
 *
 * Storage:
 *   - PDFs render server-side and write to `public/receipts/{invoiceId}.pdf`
 *   - The relative path is stored on Invoice.pdfUrl
 *   - This is the SWAP POINT for Vercel Blob integration in production
 *     — replace `writePdfToStorage` with a `@vercel/blob` upload call.
 *     The data shape stays the same; only the storage layer changes.
 */

import 'server-only';

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from './db';
import { ReceiptDocument, type ReceiptData } from './receipt-pdf';

const PUBLIC_RECEIPTS_DIR = path.join(process.cwd(), 'public', 'receipts');

/**
 * Build the receipt number for a given year + 5-digit sequence.
 * Format: "BS 00001-2026" — used for display only.
 */
export function formatReceiptNumber(sequence: number, year: number): string {
  return `BS ${String(sequence).padStart(5, '0')}-${year}`;
}

/**
 * Find the next available sequence number for invoices issued in a given
 * calendar year. We look at the maximum numeric suffix across all invoices
 * with the current year's receipts and add 1. If no invoices exist for
 * the year, start at 1.
 *
 * The implementation parses Invoice.number as a string. It assumes the
 * canonical format is a 5-digit zero-padded sequence (per schema comment).
 */
export async function nextInvoiceSequence(year: number): Promise<number> {
  const yearSuffix = String(year);
  // All Invoice.number values are zero-padded 5-digit strings, so the
  // natural string ordering is the same as numeric ordering for the
  // same length. Filter by checking the last 4 chars match the year.
  const allThisYear = await db.invoice.findMany({
    where: { deletedAt: null },
    select: { number: true },
  });
  let max = 0;
  for (const inv of allThisYear) {
    if (inv.number.length >= 4 && inv.number.slice(-4) === yearSuffix) {
      const seq = parseInt(inv.number.slice(0, 5), 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
  }
  return max + 1;
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

  // Compute sequence + display number
  const issuedAt = payment.paidAt ?? new Date();
  const year = issuedAt.getUTCFullYear();
  const sequence = await nextInvoiceSequence(year);
  const number = `${String(sequence).padStart(5, '0')}${year}`;

  // VAT split (inclusive pricing: gross = net + vat, where vat = 12% of net)
  const grossCentavos = payment.amountPhp * 100;
  const netCentavos = Math.round(grossCentavos / 1.12);
  const vatCentavos = grossCentavos - netCentavos;

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

  // Build the display number from the stored year-suffix.
  const year = invoice.number.slice(-4);
  const seq = invoice.number.slice(0, 5);
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
  const absPath = path.join(PUBLIC_RECEIPTS_DIR, fileName);
  await fs.mkdir(PUBLIC_RECEIPTS_DIR, { recursive: true });
  await fs.writeFile(absPath, buffer);
  const publicPath = `/receipts/${fileName}`;

  await db.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl: publicPath },
  });

  return { pdfPath: publicPath, receiptNumber };
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
