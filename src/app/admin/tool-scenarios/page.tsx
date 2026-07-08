import { requireAdmin } from '@/lib/auth';
import { TOOL_REGISTRY } from '@/engine/registry';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import styles from './tool-scenarios.module.css';

export const metadata = { title: 'Tool Scenarios — Admin' };

export default async function ToolScenariosPage() {
  await requireAdmin();
  const tools = Object.values(TOOL_REGISTRY);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Tool Scenarios</h1>
          <p className={styles.subtitle}>View all scenario packs. Scenarios are defined in TypeScript engine code.</p>
        </div>
      </header>

      <div className={styles.layout}>
        {tools.map((tool) => (
          <section key={tool.slug} className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Icon name="Gear" size="md" />
                <h2>{tool.name}</h2>
              </div>
              <span className={styles.count}>{tool.scenarios.length} scenarios</span>
            </div>
            <p className={styles.description}>{tool.description}</p>
            <div className={styles.grid}>
              {tool.scenarios.map((scenario) => (
                <Link
                  key={scenario.id}
                  href={`/admin/tool-scenarios/${scenario.id}`}
                  className={styles.card}
                >
                  <span className={styles.scenarioName}>{scenario.title}</span>
                  <span className={styles.scenarioMeta}>
                    {scenario.category} &middot; {scenario.difficulty}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
