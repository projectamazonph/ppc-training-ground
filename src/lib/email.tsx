/**
 * Email sending via Resend — transactional email for Project Amazon PH Academy.
 *
 * Sprint 8 — STORY-035 / STORY-036 / STORY-037.
 *
 * Single Resend client (singleton pattern). All send functions return
 * void and log errors so they never crash the calling code path —
 * email delivery is best-effort, not a transactional guarantee.
 *
 * Brand: Deep Navy #1A1A2E, Orange #FF6B35, Space Grotesk headings.
 */

import { Resend } from 'resend';
import { BRAND_NAME } from '@/lib/brand';

// Lazy singleton: the Resend constructor throws when the API key is unset,
// so constructing at module scope breaks `next build` (page-data collection
// imports this module via the PayMongo webhook route). Defer until first send,
// which is already guarded on RESEND_API_KEY being present.
let resend: Resend | null = null;
function getResend(): Resend {
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@projectamazonph.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Send an email. Errors are logged but never thrown. */
async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to);
    return;
  }
  try {
    const { error } = await getResend().emails.send({
      from: FROM,
      to,
      subject,
      react,
    });
    if (error) {
      console.error('[email] send failed:', error.message);
    }
  } catch (err) {
    console.error('[email] unexpected error:', err);
  }
}

// ---------------------------------------------------------------------------
// Enrollment confirmation
// ---------------------------------------------------------------------------

interface EnrollmentEmailProps {
  to: string;
  studentName: string;
  tierName: string;
}

export async function sendEnrollmentConfirmationEmail({
  to,
  studentName,
  tierName,
}: EnrollmentEmailProps): Promise<void> {
  await sendEmail({
    to,
    subject: `You're enrolled — ${tierName} on ${BRAND_NAME}`,
    react: (
      <EnrollmentConfirmationEmail
        studentName={studentName}
        tierName={tierName}
        appUrl={APP_URL}
      />
    ),
  });
}

function EnrollmentConfirmationEmail({
  studentName,
  tierName,
  appUrl,
}: {
  studentName: string;
  tierName: string;
  appUrl: string;
}) {
  return (
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: '#F5F5F0',
        padding: '40px 20px',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      <div style={{ backgroundColor: '#1A1A2E', borderRadius: '12px', padding: '32px' }}>
        <p
          style={{
            color: '#FF6B35',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: '0 0 8px',
          }}
        >
          {BRAND_NAME}
        </p>
        <h1
          style={{
            color: '#FFFFFF',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 20px',
          }}
        >
          Welcome to {tierName}, {studentName}!
        </h1>
        <p style={{ color: '#D4D4C8', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px' }}>
          Your enrollment is confirmed. You now have full access to all modules
         , lessons, and tools in your chosen tier.
        </p>
        <a
          href={`${appUrl}/dashboard`}
          style={{
            display: 'inline-block',
            backgroundColor: '#FF6B35',
            color: '#FFFFFF',
            textDecoration: 'none',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontWeight: 600,
            fontSize: '14px',
            padding: '12px 24px',
            borderRadius: '8px',
          }}
        >
          Go to your dashboard →
        </a>
      </div>
      <p
        style={{
          color: '#6B6B6B',
          fontSize: '12px',
          textAlign: 'center',
          margin: '20px 0 0',
        }}
      >
        {`${BRAND_NAME} · projectamazonph.com`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refund status email
// ---------------------------------------------------------------------------

type RefundStatusKind = 'requested' | 'approved' | 'rejected';

interface RefundStatusEmailProps {
  to: string;
  studentName: string;
  tierName: string;
  amountPhp: number;
  status: RefundStatusKind;
  reason?: string | null;
  paymongoRefundId?: string | null;
  reviewerNotes?: string | null;
}

export async function sendRefundStatusEmail({
  to,
  studentName,
  tierName,
  amountPhp,
  status,
  reason,
  paymongoRefundId,
  reviewerNotes,
}: RefundStatusEmailProps): Promise<void> {
  const amount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amountPhp / 100); // money fields store centavos

  const subject =
    status === 'requested'
      ? `Refund request received — ${tierName}`
      : status === 'approved'
        ? `Your refund of ${amount} is being processed`
        : `Your refund request was not approved`;

  await sendEmail({
    to,
    subject,
    react: (
      <RefundStatusEmail
        studentName={studentName}
        tierName={tierName}
        amount={amount}
        status={status}
        reason={reason}
        paymongoRefundId={paymongoRefundId}
        reviewerNotes={reviewerNotes}
        appUrl={APP_URL}
      />
    ),
  });
}

function RefundStatusEmail({
  studentName,
  tierName,
  amount,
  status,
  reason,
  paymongoRefundId,
  reviewerNotes,
  appUrl,
}: {
  studentName: string;
  tierName: string;
  amount: string;
  status: RefundStatusKind;
  reason?: string | null;
  paymongoRefundId?: string | null;
  reviewerNotes?: string | null;
  appUrl: string;
}) {
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const isRequested = status === 'requested';

  const headingColor = isApproved ? '#28A745' : isRejected ? '#DC3545' : '#FF6B35';
  const ctaBg = isRequested ? '#FF6B35' : isApproved ? '#28A745' : '#1A1A2E';

  return (
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: '#F5F5F0',
        padding: '40px 20px',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      <div style={{ backgroundColor: '#1A1A2E', borderRadius: '12px', padding: '32px' }}>
        <p
          style={{
            color: '#FF6B35',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: '0 0 8px',
          }}
        >
          {BRAND_NAME}
        </p>
        <h1
          style={{
            color: headingColor,
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '22px',
            fontWeight: 700,
            margin: '0 0 16px',
          }}
        >
          {isRequested && `Refund request received`}
          {isApproved && `Refund approved`}
          {isRejected && `Refund not approved`}
        </h1>
        <p style={{ color: '#D4D4C8', fontSize: '15px', lineHeight: 1.6, margin: '0 0 20px' }}>
          Hi {studentName},
        </p>
        {isRequested && (
          <p style={{ color: '#D4D4C8', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px' }}>
            We received your refund request for your {tierName} enrollment (
            {amount}). Our team reviews every request personally — you will hear
            back within one business day.
          </p>
        )}
        {isApproved && (
          <p style={{ color: '#D4D4C8', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px' }}>
            Your refund of {amount} for {tierName} has been approved and is
            being processed through PayMongo. The amount will appear on your
            original payment method within 5–10 business days.
          </p>
        )}
        {isRejected && (
          <>
            <p style={{ color: '#D4D4C8', fontSize: '15px', lineHeight: 1.6, margin: '0 0 16px' }}>
              Your refund request for {tierName} ({amount}) was not approved.
            </p>
            {reviewerNotes && (
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderLeft: '3px solid #DC3545',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  marginBottom: '24px',
                }}
              >
                <p
                  style={{
                    color: '#D4D4C8',
                    fontSize: '14px',
                    margin: '0 0 4px',
                    fontStyle: 'italic',
                  }}
                >
                  Reason from our team:
                </p>
                <p style={{ color: '#FFFFFF', fontSize: '14px', margin: 0 }}>{reviewerNotes}</p>
              </div>
            )}
          </>
        )}
        <a
          href={`${appUrl}/dashboard/payments`}
          style={{
            display: 'inline-block',
            backgroundColor: ctaBg,
            color: '#FFFFFF',
            textDecoration: 'none',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontWeight: 600,
            fontSize: '14px',
            padding: '12px 24px',
            borderRadius: '8px',
          }}
        >
          View payment history →
        </a>
      </div>
      <p
        style={{
          color: '#6B6B6B',
          fontSize: '12px',
          textAlign: 'center',
          margin: '20px 0 0',
        }}
      >
        {`${BRAND_NAME} · projectamazonph.com`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live class reminder email
// ---------------------------------------------------------------------------

interface LiveClassReminderEmailProps {
  to: string;
  studentName: string;
  classTitle: string;
  instructorName: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetingUrl?: string | null;
}

export async function sendLiveClassReminderEmail({
  to,
  studentName,
  classTitle,
  instructorName,
  scheduledAt,
  durationMinutes,
  meetingUrl,
}: LiveClassReminderEmailProps): Promise<void> {
  const date = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(scheduledAt);

  const time = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(scheduledAt);

  await sendEmail({
    to,
    subject: `Reminder: ${classTitle} is coming up`,
    react: (
      <LiveClassReminderEmail
        studentName={studentName}
        classTitle={classTitle}
        instructorName={instructorName}
        date={date}
        time={time}
        durationMinutes={durationMinutes}
        meetingUrl={meetingUrl}
        appUrl={APP_URL}
      />
    ),
  });
}

function LiveClassReminderEmail({
  studentName,
  classTitle,
  instructorName,
  date,
  time,
  durationMinutes,
  meetingUrl,
  appUrl,
}: {
  studentName: string;
  classTitle: string;
  instructorName: string;
  date: string;
  time: string;
  durationMinutes: number;
  meetingUrl?: string | null;
  appUrl: string;
}) {
  return (
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: '#F5F5F0',
        padding: '40px 20px',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      <div style={{ backgroundColor: '#1A1A2E', borderRadius: '12px', padding: '32px' }}>
        <p
          style={{
            color: '#FF6B35',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: '0 0 8px',
          }}
        >
          {`${BRAND_NAME} · Live Class`}
        </p>
        <h1
          style={{
            color: '#FFFFFF',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 8px',
          }}
        >
          {classTitle}
        </h1>
        <p
          style={{
            color: '#FF6B35',
            fontFamily: 'Space Grotesk, system-ui, sans-serif',
            fontSize: '16px',
            fontWeight: 600,
            margin: '0 0 24px',
          }}
        >
          with {instructorName}
        </p>
        <p style={{ color: '#D4D4C8', fontSize: '15px', lineHeight: 1.6, margin: '0 0 20px' }}>
          Hi {studentName}, this is a reminder that your live class is coming up.
        </p>
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <p style={{ color: '#D4D4C8', fontSize: '14px', margin: '0 0 4px' }}>
            {date} · {time}
          </p>
          <p style={{ color: '#D4D4C8', fontSize: '14px', margin: 0 }}>
            {durationMinutes} minutes
          </p>
        </div>
        {meetingUrl ? (
          <a
            href={meetingUrl}
            style={{
              display: 'inline-block',
              backgroundColor: '#FF6B35',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontFamily: 'Space Grotesk, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              padding: '12px 24px',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            Join the class →
          </a>
        ) : (
          <a
            href={`${appUrl}/dashboard/live-classes`}
            style={{
              display: 'inline-block',
              backgroundColor: '#FF6B35',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontFamily: 'Space Grotesk, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              padding: '12px 24px',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            View class details →
          </a>
        )}
        <p
          style={{
            color: '#6B6B6B',
            fontSize: '12px',
            marginTop: '12px',
          }}
        >
          A recording will be available after the session if you cannot attend.
        </p>
      </div>
      <p
        style={{
          color: '#6B6B6B',
          fontSize: '12px',
          textAlign: 'center',
          margin: '20px 0 0',
        }}
      >
        {`${BRAND_NAME} · projectamazonph.com`}
      </p>
    </div>
  );
}
