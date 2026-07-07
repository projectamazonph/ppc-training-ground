import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getToolMeta, getScenarioMeta } from '@/engine/registry';
import { getScenarioBySlug as getCb } from '@/engine/campaign-builder/scenarios';
import { getBtvScenarioBySlug as getBtv } from '@/engine/campaign-builder/btv-scenarios';
import { getScenarioBySlug as getBe } from '@/engine/bid-elevator/scenarios';
import { getScenarioBySlug as getStr } from '@/engine/str-triage/scenarios';
import { getScenarioBySlug as getLa } from '@/engine/listing-audit/scenarios';
import { getScenarioBySlug as getKr } from '@/engine/keyword-research/scenarios';
import { startToolSession } from '@/app/actions/tools';
import { CampaignBuilderRunner } from '@/components/tools/CampaignBuilderRunner';
import { BidElevatorRunner } from '@/components/tools/BidElevatorRunner';
import { StrTriageRunner } from '@/components/tools/StrTriageRunner';
import { ListingAuditRunner } from '@/components/tools/ListingAuditRunner';
import { KeywordResearchRunner } from '@/components/tools/KeywordResearchRunner';
import styles from './runner.module.css';

interface PageProps {
  params: Promise<{ tool: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tool, slug } = await params;
  const toolMeta = getToolMeta(tool);
  const scenarioMeta = getScenarioMeta(tool, slug);
  if (!toolMeta || !scenarioMeta) return { title: 'Not found' };
  return { title: `${scenarioMeta.title} — ${toolMeta.name}` };
}

export default async function ToolRunnerPage({ params }: PageProps) {
  const user = await requireAuth();
  const { tool: toolSlug, slug: scenarioSlug } = await params;

  const toolMeta = getToolMeta(toolSlug);
  const scenarioMeta = getScenarioMeta(toolSlug, scenarioSlug);
  if (!toolMeta || !scenarioMeta) notFound();

  // Resolve full scenario from the appropriate engine
  const scenario = resolveScenario(toolSlug, scenarioSlug);
  if (!scenario) notFound();

  // Start a session server-side and render the appropriate runner
  const result = await startToolSession({
    toolType: toolMeta.toolType,
    scenarioId: scenario.id,
  });

  if (!result.success) {
    return (
      <main className="container" style={{ padding: 'var(--space-8) 0' }}>
        <h1>Could not start session</h1>
        <p style={{ color: 'var(--danger)' }}>{result.error}</p>
        <Link href={`/dashboard/tools/${toolSlug}` as never}>← Back to scenarios</Link>
      </main>
    );
  }

  // Render tool-specific UI
  return (
    <main id="main-content" className="container" style={{ padding: 'var(--space-6) 0' }}>
      <Link
        href={`/dashboard/tools/${toolSlug}` as never}
        style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}
      >
        ← {toolMeta.name} scenarios
      </Link>

      <header className={styles.header}>
        <h1 style={{ margin: 'var(--space-2) 0' }}>{scenarioMeta.title}</h1>
      </header>

      {toolSlug === 'campaign-builder' && (
        <CampaignBuilderRunner
          sessionId={result.data.sessionId}
          scenario={scenario as Parameters<typeof CampaignBuilderRunner>[0]['scenario']}
          toolSlug={toolSlug}
        />
      )}
      {toolSlug === 'bid-elevator' && (
        <BidElevatorRunner
          sessionId={result.data.sessionId}
          scenario={scenario as Parameters<typeof BidElevatorRunner>[0]['scenario']}
          toolSlug={toolSlug}
        />
      )}
      {toolSlug === 'str-triage' && (
        <StrTriageRunner
          sessionId={result.data.sessionId}
          scenario={scenario as Parameters<typeof StrTriageRunner>[0]['scenario']}
          toolSlug={toolSlug}
        />
      )}
      {toolSlug === 'listing-audit' && (
        <ListingAuditRunner
          sessionId={result.data.sessionId}
          scenario={scenario as Parameters<typeof ListingAuditRunner>[0]['scenario']}
          toolSlug={toolSlug}
        />
      )}
      {toolSlug === 'keyword-research' && (
        <KeywordResearchRunner
          sessionId={result.data.sessionId}
          scenario={scenario as Parameters<typeof KeywordResearchRunner>[0]['scenario']}
          toolSlug={toolSlug}
        />
      )}
    </main>
  );
}

function resolveScenario(toolSlug: string, scenarioSlug: string) {
  if (toolSlug === 'campaign-builder') {
    return getCb(scenarioSlug) ?? getBtv(scenarioSlug);
  }
  if (toolSlug === 'bid-elevator') return getBe(scenarioSlug);
  if (toolSlug === 'str-triage') return getStr(scenarioSlug);
  if (toolSlug === 'listing-audit') return getLa(scenarioSlug);
  if (toolSlug === 'keyword-research') return getKr(scenarioSlug);
  return null;
}
