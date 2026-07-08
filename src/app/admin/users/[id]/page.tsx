import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatPhp, formatDate, formatDateTime } from '@/lib/format';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
import {
  suspendUserAction,
  reactivateUserAction,
  deleteUserAction,
} from '@/app/actions/admin-users';
import styles from './user-detail.module.css';

export const metadata = { title: 'User Detail — Admin' };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: { pricingTier: true },
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        include: { pricingTier: true },
        orderBy: { createdAt: 'desc' },
      },
      badges: {
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      },
      toolSessions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!user) notFound();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/users" className={styles.back}>
          <Icon name="CaretLeft" size="sm" /> Users
        </Link>
      </header>

      <div className={styles.grid}>
        {/* Profile */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Profile</h2>
          <dl className={styles.dl}>
            <dt>Name</dt>
            <dd>{user.name ?? '—'}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>
              <Badge variant={user.role === 'ADMIN' ? 'warning' : 'default'}>
                {user.role}
              </Badge>
            </dd>
            <dt>Status</dt>
            <dd>
              <Badge
                variant={
                  user.status === 'ACTIVE'
                    ? 'success'
                    : user.status === 'SUSPENDED'
                      ? 'danger'
                      : 'default'
                }
              >
                {user.status}
              </Badge>
            </dd>
            <dt>XP / Level</dt>
            <dd>
              {user.xp.toLocaleString()} XP — Level {user.level}
            </dd>
            <dt>Joined</dt>
            <dd>{formatDateTime(user.createdAt)}</dd>
            {user.deletedAt && (
              <>
                <dt>Deleted</dt>
                <dd>{formatDateTime(user.deletedAt)}</dd>
              </>
            )}
          </dl>

          {user.status !== 'DELETED' && (
            <div className={styles.actions}>
              {user.status === 'ACTIVE' ? (
                <form action={suspendUserAction.bind(null, user.id)}>
                  <button className={styles.dangerBtn}>Suspend User</button>
                </form>
              ) : (
                <form action={reactivateUserAction.bind(null, user.id)}>
                  <button className={styles.primaryBtn}>Reactivate</button>
                </form>
              )}
              <form
                action={deleteUserAction.bind(null, user.id)}
                onSubmit={(e) => {
                  if (
                    !confirm('Soft-delete this user? They will lose access immediately.')
                  )
                    e.preventDefault();
                }}
              >
                <button className={styles.dangerBtn}>Delete</button>
              </form>
            </div>
          )}
        </section>

        {/* Enrollments */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Enrollments ({user.enrollments.length})
          </h2>
          {user.enrollments.length === 0 ? (
            <p className={styles.empty}>No enrollments yet.</p>
          ) : (
            <div className={styles.list}>
              {user.enrollments.map((e) => (
                <div key={e.id} className={styles.listItem}>
                  <div className={styles.itemTitle}>
                    {e.pricingTier?.name ?? '—'}
                  </div>
                  <div className={styles.itemMeta}>
                    <Badge
                      variant={e.status === 'ACTIVE' ? 'success' : 'default'}
                    >
                      {e.status}
                    </Badge>
                    <span>{formatDate(e.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Payments */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Payments ({user.payments.length})
          </h2>
          {user.payments.length === 0 ? (
            <p className={styles.empty}>No payments yet.</p>
          ) : (
            <div className={styles.list}>
              {user.payments.map((p) => (
                <div key={p.id} className={styles.listItem}>
                  <div className={styles.itemTitle}>
                    {formatPhp(p.amountPhp)}{' '}
                    <Badge variant={p.status === 'PAID' ? 'success' : 'default'}>
                      {p.status}
                    </Badge>
                  </div>
                  <div className={styles.itemMeta}>
                    {p.pricingTier?.name} · {formatDate(p.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Badges */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Badges ({user.badges.length})</h2>
          {user.badges.length === 0 ? (
            <p className={styles.empty}>No badges yet.</p>
          ) : (
            <div className={styles.badgeGrid}>
              {user.badges.map((ub) => (
                <div key={ub.id} className={styles.badgeItem}>
                  <div className={styles.badgeIcon}>{ub.badge.icon}</div>
                  <div className={styles.badgeName}>{ub.badge.title}</div>
                  <div className={styles.badgeDate}>{formatDate(ub.earnedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Audit Log */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Audit Log</h2>
          {user.auditLogs.length === 0 ? (
            <p className={styles.empty}>No actions recorded.</p>
          ) : (
            <div className={styles.auditList}>
              {user.auditLogs.map((log) => (
                <div key={log.id} className={styles.auditItem}>
                  <div className={styles.auditAction}>{log.action}</div>
                  <div className={styles.auditMeta}>
                    {log.entityType}:{log.entityId} ·{' '}
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
