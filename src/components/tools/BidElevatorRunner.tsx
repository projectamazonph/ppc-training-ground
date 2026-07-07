'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { submitToolSession, saveToolSession } from '@/app/actions/tools';
import type {
  BidScenario,
  KeywordDecision,
  BidElevatorSessionState,
} from '@/engine/bid-elevator/types';
import { ToolResult } from './ToolResult';
import styles from './BidElevatorRunner.module.css';

interface BidElevatorRunnerProps {
  sessionId: string;
  scenario: BidScenario;
  toolSlug: string;
}

function formatPhp(value: number): string {
  return `₱${value.toLocaleString('en-PH')}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function currentAcos(spend: number, sales: number): number | null {
  if (sales === 0) return null;
  return spend / sales;
}

export function BidElevatorRunner({ sessionId, scenario, toolSlug }: BidElevatorRunnerProps) {
  const [bids, setBids] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const k of scenario.keywords) {
      initial[k.id] = k.currentBid;
    }
    return initial;
  });
  const [result, setResult] = useState<{
    totalScore: number;
    passed: boolean;
    overallFeedback: string;
    criteriaResults: Array<{ criterionId: string; passed: boolean; score: number; feedback: string }>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Daily budget preview: sum of (newBid * currentClicks_per_day) is a rough
  // proxy. Use total projected spend = sum of new bids * (impressions/1000 * ctr-per-clicks).
  // Simpler: just sum new bids as a coarse "what if you bid this much per keyword" gauge.
  const projectedSpend = useMemo(() => {
    return scenario.keywords.reduce((sum, k) => sum + (bids[k.id] ?? 0), 0);
  }, [bids, scenario.keywords]);

  const overBudget = projectedSpend > scenario.constraints.dailyBudget;
  const changedCount = scenario.keywords.filter(
    (k) => bids[k.id] !== k.currentBid,
  ).length;

  function setBid(keywordId: string, value: number) {
    setBids((prev) => ({ ...prev, [keywordId]: Math.max(0, value) }));
  }

  async function persistAndSubmit() {
    setError(null);
    startTransition(async () => {
      const decisions: KeywordDecision[] = scenario.keywords.map((k) => ({
        keywordId: k.id,
        newBid: bids[k.id] ?? k.currentBid,
      }));
      const state: BidElevatorSessionState = {
        scenarioId: scenario.id,
        currentRound: scenario.constraints.roundsRemaining,
        hintsUsed: 0,
        startedAt: new Date().toISOString(),
        decisions,
        budgetRemaining: scenario.constraints.dailyBudget - projectedSpend,
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
          <Badge variant="info">Bid Elevator</Badge>
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
            <span className={styles.targetLabel}>Current daily spend</span>
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
          <div className={styles.targetStat}>
            <span className={styles.targetLabel}>Rounds remaining</span>
            <span className={styles.targetValue}>
              {scenario.constraints.roundsRemaining}
            </span>
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <div className={styles.tableWrap}>
          <table className={styles.bidTable}>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Match</th>
                <th>Current bid</th>
                <th>Impr</th>
                <th>Clicks</th>
                <th>Orders</th>
                <th>Spend</th>
                <th>Sales</th>
                <th>ACoS</th>
                <th>New bid</th>
              </tr>
            </thead>
            <tbody>
              {scenario.keywords.map((k) => {
                const acos = currentAcos(k.spend, k.sales);
                const newBid = bids[k.id] ?? k.currentBid;
                const changed = newBid !== k.currentBid;
                return (
                  <tr key={k.id} data-changed={changed} data-acos={acos === null ? 'none' : acos > scenario.product.targetAcos ? 'high' : 'ok'}>
                    <td className={styles.keywordCell}>{k.text}</td>
                    <td>
                      <Badge variant="default">{k.matchType}</Badge>
                    </td>
                    <td className={styles.numCell}>{formatPhp(k.currentBid)}</td>
                    <td className={styles.numCell}>{k.impressions.toLocaleString('en-PH')}</td>
                    <td className={styles.numCell}>{k.clicks}</td>
                    <td className={styles.numCell}>{k.orders}</td>
                    <td className={styles.numCell}>{formatPhp(k.spend)}</td>
                    <td className={styles.numCell}>{formatPhp(k.sales)}</td>
                    <td className={styles.numCell}>
                      {acos === null ? <em>—</em> : formatPct(acos)}
                    </td>
                    <td className={styles.bidInputCell}>
                      <span className={styles.pesoSign}>₱</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={newBid}
                        onChange={(e) => setBid(k.id, Number(e.target.value))}
                        aria-label={`New bid for ${k.text}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="md" className={styles.previewCard} data-over={overBudget}>
        <div className={styles.previewRow}>
          <div>
            <span className={styles.previewLabel}>Projected daily spend</span>
            <span className={styles.previewValue}>{formatPhp(projectedSpend)}</span>
          </div>
          <div>
            <span className={styles.previewLabel}>Budget headroom</span>
            <span
              className={styles.previewValue}
              data-positive={!overBudget}
            >
              {formatPhp(scenario.constraints.dailyBudget - projectedSpend)}
            </span>
          </div>
          <div>
            <span className={styles.previewLabel}>Bids changed</span>
            <span className={styles.previewValue}>
              {changedCount} / {scenario.keywords.length}
            </span>
          </div>
        </div>
        {overBudget && (
          <p className={styles.warning}>
            <Icon name="Warning" size="sm" /> Total new bids exceed the daily budget. Trim the
            high-ACoS keywords to bring the spend back in line.
          </p>
        )}
      </Card>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.submitRow}>
        <Button onClick={persistAndSubmit} variant="primary" disabled={pending}>
          {pending ? 'Grading…' : 'Submit bids'}
        </Button>
        <p className={styles.hint}>
          Tip: the engine compares your new bid against the reference for each keyword. A bid
          within ±20% of reference is full credit. Off by more — partial.
        </p>
      </div>
    </div>
  );
}
