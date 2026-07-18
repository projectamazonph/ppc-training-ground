import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { Icon, type PhosphorIconName } from '@/components/ui/Icon';
import { SCENARIOS as CB_SCENARIOS, BTV_SCENARIOS } from '@/engine/campaign-builder/scenarios';
import { SCENARIOS as BE_SCENARIOS } from '@/engine/bid-elevator/scenarios';
import { SCENARIOS as STR_SCENARIOS } from '@/engine/str-triage/scenarios';
import { SCENARIOS as LA_SCENARIOS } from '@/engine/listing-audit/scenarios';
import { SCENARIOS as KR_SCENARIOS } from '@/engine/keyword-research/scenarios';
import styles from './tools.module.css';

interface ToolMeta {
  id: 'campaign-builder' | 'bid-elevator' | 'str-triage' | 'listing-audit' | 'keyword-research';
  name: string;
  description: string;
  icon: PhosphorIconName;
  scenarioCount: number;
}

const TOOLS: ToolMeta[] = [
  {
    id: 'campaign-builder',
    name: 'Campaign Builder',
    description: 'Build Sponsored Products, Brands, Display, and Sponsored TV campaigns. Practice the Amazon Advertising Console campaign wizard end-to-end.',
    icon: 'Rocket',
    scenarioCount: CB_SCENARIOS.length + BTV_SCENARIOS.length,
  },
  {
    id: 'bid-elevator',
    name: 'Bid Elevator',
    description: 'Adjust keyword bids against real performance data. Cut waste, raise converters, defend ACoS at target.',
    icon: 'ChartLine',
    scenarioCount: BE_SCENARIOS.length,
  },
  {
    id: 'str-triage',
    name: 'Search Term Triage',
    description: 'Triage search terms: keep, pause, negate, or optimize bids. Practice the weekly STR workflow.',
    icon: 'List',
    scenarioCount: STR_SCENARIOS.length,
  },
  {
    id: 'listing-audit',
    name: 'Listing Audit',
    description: 'Score a product listing on title, bullets, images, A+ content. Find what is hurting conversion.',
    icon: 'BookOpen',
    scenarioCount: LA_SCENARIOS.length,
  },
  {
    id: 'keyword-research',
    name: 'Keyword Research',
    description: 'Categorize keywords as primary, secondary, or negative. Build the keyword list that drives Sponsored Products.',
    icon: 'MagnifyingGlass',
    scenarioCount: KR_SCENARIOS.length,
  },
];

export const metadata = {
  title: 'Tools',
};

export default async function ToolsIndexPage() {
  const user = await requireAuth();
  const heroTool = TOOLS[0];
  if (!heroTool) throw new Error('TOOLS must have at least one entry');
  const restTools = TOOLS.slice(1);

  return (
    <main id="main-content" className="container" style={{ padding: 'var(--space-8) 0' }}>
      <header style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ marginBottom: 'var(--space-2)' }}>Practice tools</h1>
        <p style={{ color: 'var(--ink-500)', maxWidth: '640px' }}>
          Each tool mirrors a real Amazon Advertising Console workflow. Pick a tool, then pick
          a scenario. Your work saves automatically, so you can come back anytime.
        </p>
      </header>

      <Card key={heroTool.id} variant="interactive" padding="lg" className={styles.heroCard}>
        <Link href={`/tools/${heroTool.id}` as never} className={styles.toolLink}>
          <CardHeader>
            <div className={styles.toolHeader}>
              <Icon name={heroTool.icon} size="xl" />
              <Badge variant="default">{heroTool.scenarioCount} scenarios</Badge>
            </div>
            <CardTitle className={styles.heroTitle}>{heroTool.name}</CardTitle>
            <CardDescription>{heroTool.description}</CardDescription>
          </CardHeader>
        </Link>
      </Card>

      <section className={styles.toolGrid}>
        {restTools.map((tool) => (
          <Card key={tool.id} variant="interactive" padding="lg">
            <Link href={`/tools/${tool.id}` as never} className={styles.toolLink}>
              <CardHeader>
                <div className={styles.toolHeader}>
                  <Icon name={tool.icon} size="lg" />
                  <Badge variant="default">{tool.scenarioCount} scenarios</Badge>
                </div>
                <CardTitle>{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        ))}
      </section>
    </main>
  );
}
