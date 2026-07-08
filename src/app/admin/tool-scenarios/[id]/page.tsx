import { requireAdmin } from '@/lib/auth';
import { TOOL_REGISTRY } from '@/engine/registry';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import styles from './scenario-detail.module.css';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const scenario = findScenario(params.id);
  return { title: scenario ? `${scenario.title} — Admin` : 'Not Found' };
}

function findScenario(id: string) {
  for (const tool of Object.values(TOOL_REGISTRY)) {
    const found = tool.scenarios.find((s) => s.id === id);
    if (found) return { ...found, toolName: tool.name };
  }
  return null;
}

export default async function ScenarioDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const scenario = findScenario(params.id);
  if (!scenario) notFound();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/tool-scenarios" className={styles.back}>
          <Icon name="CaretLeft" size="sm" /> Tool Scenarios
        </Link>
      </header>

      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{scenario.title}</h2>
            </div>
            <dl className={styles.dl}>
              <dt>Tool</dt><dd>{scenario.toolName}</dd>
              <dt>Category</dt><dd>{scenario.category}</dd>
              <dt>Difficulty</dt><dd>{scenario.difficulty}</dd>
              <dt>Slug</dt><dd className={styles.mono}>{scenario.slug}</dd>
            </dl>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Note</h3>
            <p className={styles.note}>
              Scenarios are defined in TypeScript engine code. Edit them in{' '}
              <code className={styles.code}>src/engine/</code>.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
