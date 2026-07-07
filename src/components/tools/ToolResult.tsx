import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
import styles from './ToolResult.module.css';

export interface ToolResultProps {
  toolSlug: string;
  scenarioTitle: string;
  totalScore: number;
  passed: boolean;
  overallFeedback: string;
  criteriaResults: Array<{
    criterionId: string;
    passed: boolean;
    score: number;
    feedback: string;
  }>;
}

export function ToolResult({
  toolSlug,
  scenarioTitle,
  totalScore,
  passed,
  overallFeedback,
  criteriaResults,
}: ToolResultProps) {
  return (
    <main id="main-content" className="container" style={{ padding: 'var(--space-6) 0' }}>
      <Card padding="lg" className={styles.resultCard}>
        <div className={styles.headerRow}>
          <div className={styles.scoreCircle} data-passed={passed}>
            {totalScore}
            <span className={styles.scoreSuffix}>%</span>
          </div>
          <div>
            <Badge variant={passed ? 'success' : 'warning'}>
              {passed ? 'Passed' : 'Try again'}
            </Badge>
            <CardTitle>{passed ? 'You passed' : 'Not quite'}</CardTitle>
            <CardDescription>{scenarioTitle}</CardDescription>
          </div>
        </div>

        <p className={styles.feedback}>{overallFeedback}</p>

        <section className={styles.criteriaSection}>
          <h3 className={styles.criteriaHeader}>Criteria breakdown</h3>
          <ul className={styles.criteriaList}>
            {criteriaResults.map((c) => (
              <li key={c.criterionId} className={styles.criteriaItem} data-passed={c.passed}>
                <span className={styles.criteriaIcon}>
                  {c.passed ? <Icon name="Check" size="sm" /> : <Icon name="X" size="sm" />}
                </span>
                <div>
                  <div className={styles.criteriaTitle}>
                    {c.criterionId.replace(/-/g, ' ')}
                    <span className={styles.criteriaScore}>{c.score} pts</span>
                  </div>
                  <p className={styles.criteriaFeedback}>{c.feedback}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.actions}>
          <Link
            href={`/dashboard/tools/${toolSlug}` as never}
            className={`${styles.actionLink} ${styles.actionPrimary}`}
          >
            <Icon name="List" size="sm" /> More scenarios
          </Link>
          <Link href="/dashboard/tools" className={`${styles.actionLink} ${styles.actionSecondary}`}>
            All tools
          </Link>
        </div>
      </Card>
    </main>
  );
}
