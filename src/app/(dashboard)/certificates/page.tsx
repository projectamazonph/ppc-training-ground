import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { listMyCertificatesAction } from '@/app/actions/certificates';
import { Card, CardHeader, CardTitle, CardDescription, Badge, Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { BRAND_NAME, BRAND_CERT_PREFIX } from '@/lib/brand';
import styles from './certificates.module.css';

export const metadata = {
  title: `My Certificates — ${BRAND_NAME}`,
};

export default async function CertificatesPage() {
  const user = await requireAuth();
  const certificates = await listMyCertificatesAction();

  const issuedDateFmt = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>YOUR ACHIEVEMENTS</p>
          <h1 className={styles.title}>Certificates</h1>
          <p className={styles.subtitle}>
            Earn a certificate by completing every lesson in a course. Share the verification
            link on LinkedIn or with employers.
          </p>
        </div>
      </header>

      {certificates.length === 0 ? (
        <Card className={styles.emptyCard}>
          <CardHeader>
            <CardTitle>No certificates yet</CardTitle>
            <CardDescription>
              Finish every lesson in a course to unlock your printable certificate of completion.
            </CardDescription>
          </CardHeader>
          <div className={styles.emptyCta}>
            <Link href="/dashboard">
              <Button variant="primary" leftIcon={<Icon name="ArrowRight" />}>
                Browse courses
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <ul className={styles.list} aria-label="Issued certificates">
          {certificates.map((cert) => (
            <li key={cert.id}>
              <Card className={styles.certCard}>
                <div className={styles.certIcon}>
                  <Icon name="Trophy" size="xl" />
                </div>
                <div className={styles.certBody}>
                  <p className={styles.certCourse}>{cert.course.title}</p>
                  <p className={styles.certMeta}>
                    Issued {issuedDateFmt.format(cert.issuedAt)} · Certificate no.{' '}
                    {`${BRAND_CERT_PREFIX}-${cert.verificationHash.replace(/-/g, '').slice(0, 8).toUpperCase()}`}
                  </p>
                  <div className={styles.certBadges}>
                    <Badge variant="success">{cert.course.estimatedHours} hours</Badge>
                    <Badge variant="default">Verified</Badge>
                  </div>
                </div>
                <div className={styles.certActions}>
                  <Link
                    href={`/dashboard/certificates/${cert.verificationHash}/pdf`}
                    target="_blank"
                    rel="noopener"
                  >
                    <Button variant="primary" leftIcon={<Icon name="Download" />}>
                      Download PDF
                    </Button>
                  </Link>
                  <Link
                    href={`/verify/${cert.verificationHash}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <Button variant="secondary">Public verify link</Button>
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
