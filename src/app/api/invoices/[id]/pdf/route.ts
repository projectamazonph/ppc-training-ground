/**
 * GET /api/invoices/[id]/pdf
 *
 * Sprint 6 — STORY-029.
 *
 * Returns the rendered invoice PDF as application/pdf. Auth-gated
 * (owner-only). Lazy-renders the PDF on first request and caches it
 * to local storage (swap point for Vercel Blob).
 *
 * If the PDF hasn't been generated yet (`pdfUrl` null), this route
 * triggers `renderInvoicePdf` and then returns the freshly-rendered file.
 */

import { promises as fs } from 'node:fs';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import {
  getInvoiceForUser,
  renderInvoicePdf,
  RECEIPTS_DIR,
} from '@/lib/receipts';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireAuth();
  const { id } = await params;

  const invoice = await getInvoiceForUser(id, user.id);
  if (!invoice) {
    return new Response('Invoice not found.', { status: 404 });
  }

  // Lazy-render if pdfUrl is missing (PDF hasn't been generated yet).
  let pdfPath = invoice.pdfUrl;
  if (!pdfPath) {
    const result = await renderInvoicePdf(invoice.id);
    pdfPath = result.pdfPath;
  }

  // Read from the temp-dir cache. (Swap point for Vercel Blob fetch.)
  const fileName = `${invoice.id}.pdf`;
  const absPath = path.join(RECEIPTS_DIR, fileName);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(absPath);
  } catch {
    // File missing on disk even though pdfUrl says it should exist.
    // Re-render and try again.
    await renderInvoicePdf(invoice.id);
    buffer = await fs.readFile(absPath);
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${invoice.number}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
