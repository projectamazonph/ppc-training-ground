import { renderToBuffer } from '@react-pdf/renderer';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CertificatePdf } from '@/lib/cert-pdf';
import { BRAND_CERT_PREFIX } from '@/lib/brand';

/**
 * GET /dashboard/certificates/[hash]/pdf
 *
 * Returns the rendered certificate as application/pdf. Auth-gated because the
 * certificate lists PII (full name) — only the owner can download.
 *
 * The hash is the certificate's `verificationHash` (UUID v4). Anyone with the
 * hash and auth session may fetch it.
 */

interface RouteContext {
  params: Promise<{ hash: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireAuth();
  const { hash } = await params;

  const cert = await db.certificate.findUnique({
    where: { verificationHash: hash, deletedAt: null },
    include: {
      user: { select: { name: true } },
      course: { select: { title: true, estimatedHours: true } },
    },
  });

  if (!cert) {
    return new Response('Certificate not found.', { status: 404 });
  }

  if (cert.userId !== user.id) {
    return new Response('Forbidden.', { status: 403 });
  }

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://projectamazonph.com'}/verify/${cert.verificationHash}`;

  const pdfBuffer = await renderToBuffer(
    CertificatePdf({
      recipientName: cert.user.name ?? 'Student',
      courseTitle: cert.course.title,
      courseHours: cert.course.estimatedHours,
      issuedAt: cert.issuedAt,
      verificationHash: cert.verificationHash,
      verificationUrl,
    }),
  );

  const filename = `${BRAND_CERT_PREFIX}-Certificate-${cert.course.title.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`;

  return new Response(pdfBuffer as unknown as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
