'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { submitToolSession, saveToolSession } from '@/app/actions/tools';
import type {
  StrScenario,
  StrAction,
  StrDecision,
  StrTriageSessionState,
} from '@/engine/str-triage/types';
import { ToolResult } from './ToolResult';
import styles from './StrTriageRunner.module.css';

interface StrTriageRunnerProps {
  sessionId: string;
  scenario: StrScenario;
  toolSlug: string;
}

const ACTIONS: { value: StrAction; label: string; tone: 'keep' | 'pause' | 'negate' | 'optimize' }[] = [
  { value: 'keep', label: 'Keep', tone: 'keep' },
  { value: 'optimize-bid', label: 'Optimize bid', tone: 'optimize' },
  { value: 'pause', label: 'Pause', tone: 'pause' },
  { value: 'negate-exact', label: 'Negate exact', tone: 'negate' },
  { value: 'negate-phrase', label: 'Negate phrase', tone: 'negate' },
];

function formatPhp(value: number): string {
  return `₱${value.toLocaleString('en-PH')}`;
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function StrTriageRunner({ sessionId, scenario, toolSlug }: StrTriageRunnerProps) {
  const [decisions, setDecisions] = useState<Record<string, StrDecision>>({});
  const [result, setResult] = useState<{
    totalScore: number;
    passed: boolean;
    overallFeedback: string;
    criteriaResults: Array<{ criterionId: string; passed: boolean; score: number; feedback: string }>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    let keep = 0;
    let pause = 0;
    let negate = 0;
    let optimize = 0;
    let pending = 0;
    for (const t of scenario.searchTerms) {
      const d = decisions[t.id];
      if (!d) pending++;
      else if (d.action === 'keep') keep++;
      else if (d.action === 'pause') pause++;
      else if (d.action.startsWith('negate-')) negate++;
      else if (d.action === 'optimize-bid') optimize++;
    }
    return { keep, pause, negate, optimize, pending, total: scenario.searchTerms.length };
  }, [decisions, scenario.searchTerms]);

  function setAction(termId: string, action: StrAction) {
    setDecisions((prev) => {
      const current = prev[termId];
      const base: StrDecision = {
        searchTermId: termId,
        action,
        ...(action === 'negate-exact' || action === 'negate-phrase'
          ? { negativeKeyword: current?.negativeKeyword ?? scenario.searchTerms.find((t) => t.id === termId)?.term ?? '' }
          : {}),
        ...(action === 'optimize-bid'
          ? { newBid: current?.newBid ?? Math.max(5, Math.round((current?.newBid ?? 15) / 5) * 5) }
          : {}),
      };
      // Strip the irrelevant fields when changing action.
      if (action !== 'optimize-bid') delete base.newBid;
      if (action !== 'negate-exact' && action !== 'negate-phrase') delete base.negativeKeyword;
      return { ...prev, [termId]: base };
    });
  }

  function setNewBid(termId: string, value: number) {
    setDecisions((prev) => {
      const d = prev[termId];
      if (!d) return prev;
      return { ...prev, [termId]: { ...d, newBid: Math.max(0, value) } };
    });
  }

  function setNegativeKeyword(termId: string, value: string) {
    setDecisions((prev) => {
      const d = prev[termId];
      if (!d) return prev;
      return { ...prev, [termId]: { ...d, negativeKeyword: value } };
    });
  }

  async function persistAndSubmit() {
    setError(null);
    if (counts.pending > 0) {
      setError(`Triage all ${counts.pending} remaining search term(s) before submitting.`);
      return;
    }
    startTransition(async () => {
      const decisionArray: StrDecision[] = scenario.searchTerms.map((t) => {
        const d = decisions[t.id];
        // Defensive: should never happen because we checked counts.pending, but TS doesn't know.
        if (!d) {
          return { searchTermId: t.id, action: 'pause' as const };
        }
        return d;
      });
      const state: StrTriageSessionState = {
        scenarioId: scenario.id,
        currentIndex: scenario.searchTerms.length,
        hintsUsed: 0,
        startedAt: new Date().toISOString(),
        decisions: decisionArray,
      };
      const saveRes = await saveToolSession({
        sessionId,
        state: state as unknown as Record<string, unknown>,
      });
      if (!saveRes.success) {
        setError(saveRes.error ?? 'Could not save your work.');
        return;
      }
      const submitRes = await submitToolSession({ sessionId });
      if (!submitRes.success) {
        setError(submitRes.error ?? 'Could not grade your work.');
        return;
      }
      setResult({
        totalScore: submitRes.data.totalScore,
        passed: submitRes.data.passed,
        overallFeedback: submitRes.data.overallFeedback,
        criteriaResults: submitRes.data.criteriaResults,
      });
    });
  }

  if (result) {
    return (
      <ToolResult
        toolSlug={toolSlug}
        scenarioTitle={scenario.title}
        totalScore={result.totalScore}
        passed={result.passed}
        overallFeedback={result.overallFeedback}
        criteriaResults={result.criteriaResults}
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      <Card padding="lg">
        <CardHeader>
          <Badge variant="info">Search terms</Badge>
          <CardTitle>{scenario.title}</CardTitle>
          <CardDescription>{scenario.context}</CardDescription>
        </CardHeader>
        <div className={styles.targetsRow}>
          <div className={styles.targetStat}>
            <span className={styles.targetLabel}>Daily budget</span>
            <span className={styles.targetValue}>
              {formatPhp(scenario.constraints.dailyBudget)}
            </span>
          </div>
          <div className={styles.targetStat}>
            <span className={styles.targetLabel}>Current spend</span>
            <span className={styles.targetValue}>
              {formatPhp(scenario.constraints.currentDailySpend)}
            </span>
          </div>
          <div className={styles.targetStat}>
            <span className={styles.targetLabel}>Target ACoS</span>
            <span className={styles.targetValue}>
              {formatPct(scenario.product.targetAcos)}
            </span>
          </div>
        </div>
      </Card>

      <Card padding="md" className={styles.summaryCard}>
        <div className={styles.summaryRow}>
          <SummaryStat label="Keep" value={counts.keep} variant="success" />
          <SummaryStat label="Optimize" value={counts.optimize} variant="info" />
          <SummaryStat label="Pause" value={counts.pause} variant="default" />
          <SummaryStat label="Negate" value={counts.negate} variant="warning" />
          <div className={styles.totalCell}>
            <span className={styles.totalLabel}>Pending</span>
            <span className={styles.totalValue} data-pending={counts.pending > 0}>
              {counts.pending} / {counts.total}
            </span>
          </div>
        </div>
      </Card>

      <div className={styles.termList}>
        {scenario.searchTerms.map((t) => {
          const decision = decisions[t.id];
          return (
            <Card key={t.id} padding="md" className={styles.termCard} data-decision={decision?.action ?? 'pending'}>
              <div className={styles.termHeader}>
                <div className={styles.termMain}>
                  <code className={styles.termText}>{t.term}</code>
                  <div className={styles.termMeta}>
                    <Badge variant="default">{t.matchType}</Badge>
                    <span>via <code>{t.matchedKeyword}</code></span>
                  </div>
                </div>
                <div className={styles.termMetrics}>
                  <Metric label="Impr" value={t.impressions.toLocaleString('en-PH')} />
                  <Metric label="Clicks" value={t.clicks.toString()} />
                  <Metric label="CTR" value={formatPct(t.ctr)} />
                  <Metric label="Spend" value={formatPhp(t.spend)} />
                  <Metric label="CPC" value={formatPhp(t.cpc)} />
                  <Metric label="Orders" value={t.orders.toString()} />
                  <Metric label="Sales" value={formatPhp(t.sales)} />
                  <Metric label="ACoS" value={formatPct(t.acos)} />
                </div>
              </div>

              <div className={styles.actionGroup} role="radiogroup" aria-label={`Action for ${t.term}`}>
                {ACTIONS.map((a) => {
                  const isSelected = decision?.action === a.value;
                  return (
                    <button
                      key={a.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setAction(t.id, a.value)}
                      className={`${styles.actionBtn} ${isSelected ? styles[`action${a.tone}`] : ''}`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>

              {decision?.action === 'optimize-bid' && (
                <div className={styles.subfield}>
                  <label>
                    <span>New bid (₱)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={decision.newBid ?? ''}
                      onChange={(e) => setNewBid(t.id, Number(e.target.value))}
                    />
                  </label>
                </div>
              )}
              {(decision?.action === 'negate-exact' || decision?.action === 'negate-phrase') && (
                <div className={styles.subfield}>
                  <label>
                    <span>Negative keyword to add</span>
                    <input
                      type="text"
                      value={decision.negativeKeyword ?? t.term}
                      onChange={(e) => setNegativeKeyword(t.id, e.target.value)}
                      maxLength={80}
                    />
                  </label>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.submitRow}>
        <Button onClick={persistAndSubmit} variant="primary" disabled={pending}>
          {pending ? 'Grading…' : `Submit triage (${counts.total - counts.pending} / ${counts.total})`}
        </Button>
        <p className={styles.hint}>
          Tip: ACoS above target + zero orders is a negate. Decent ACoS + a few orders is
          optimize-bid. Anything converting strongly is keep.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metricCell}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'success' | 'info' | 'warning' | 'default';
}) {
  return (
    <div className={styles.statCell}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} data-variant={variant}>
        {value}
      </span>
    </div>
  );
}
