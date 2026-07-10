'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { submitToolSession, saveToolSession } from '@/app/actions/tools';
import type {
  KeywordResearchScenario,
  KeywordPriority,
  KeywordResearchSessionState,
} from '@/engine/keyword-research/types';
import { ToolResult } from './ToolResult';
import styles from './KeywordResearchRunner.module.css';

interface KeywordResearchRunnerProps {
  sessionId: string;
  scenario: KeywordResearchScenario;
  toolSlug: string;
}

const PRIORITIES: KeywordPriority[] = ['PRIMARY', 'SECONDARY', 'NEGATIVE'];

const PRIORITY_LABEL: Record<KeywordPriority, string> = {
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  NEGATIVE: 'Negative',
};

function formatProxy(value: number): string {
  return `${Math.round(value * 100)}`;
}

export function KeywordResearchRunner({ sessionId, scenario, toolSlug }: KeywordResearchRunnerProps) {
  // candidates arrive with `priority: null` — student fills these in.
  const [decisions, setDecisions] = useState<Record<string, KeywordPriority | null>>(() => {
    const initial: Record<string, KeywordPriority | null> = {};
    for (const c of scenario.candidates) {
      initial[c.text] = c.priority;
    }
    return initial;
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    totalScore: number;
    passed: boolean;
    overallFeedback: string;
    criteriaResults: Array<{ criterionId: string; passed: boolean; score: number; feedback: string }>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    let primary = 0;
    let secondary = 0;
    let negative = 0;
    let unclassified = 0;
    for (const c of scenario.candidates) {
      const d = decisions[c.text];
      if (d === 'PRIMARY') primary++;
      else if (d === 'SECONDARY') secondary++;
      else if (d === 'NEGATIVE') negative++;
      else unclassified++;
    }
    return { primary, secondary, negative, unclassified, total: scenario.candidates.length };
  }, [decisions, scenario.candidates]);

  function setPriority(text: string, priority: KeywordPriority) {
    setDecisions((prev) => ({ ...prev, [text]: priority }));
  }

  function setNote(text: string, value: string) {
    setNotes((prev) => ({ ...prev, [text]: value }));
  }

  async function persistAndSubmit() {
    setError(null);
    if (counts.unclassified > 0) {
      setError(`Classify all ${counts.unclassified} remaining keyword(s) before submitting.`);
      return;
    }
    startTransition(async () => {
      const decisionArray = scenario.candidates.map((c) => ({
        keyword: c.text,
        priority: decisions[c.text] as KeywordPriority,
        notes: notes[c.text] || undefined,
      }));
      const negatives = decisionArray
        .filter((d) => d.priority === 'NEGATIVE')
        .map((d) => d.keyword);
      const state: KeywordResearchSessionState = {
        scenarioId: scenario.id,
        hintsUsed: 0,
        startedAt: new Date().toISOString(),
        decisions: decisionArray,
        negatives,
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
        scenarioTitle={scenario.product.name}
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
          <Badge variant="info">Seed term</Badge>
          <CardTitle>{scenario.seedTerm}</CardTitle>
          <CardDescription>
            {scenario.product.name} · {scenario.product.category}
          </CardDescription>
        </CardHeader>
        <p className={styles.brief}>
          Categorize each candidate keyword as <strong>Primary</strong> (target first),
          <strong> Secondary</strong> (worth bidding on), or <strong>Negative</strong>{' '}
          (irrelevant — add to the negative list). The engine compares your
          categorization against the reference priorities.
        </p>
      </Card>

      <Card padding="md" className={styles.summaryCard}>
        <div className={styles.summaryRow}>
          <SummaryStat label="Primary" value={counts.primary} variant="success" />
          <SummaryStat label="Secondary" value={counts.secondary} variant="info" />
          <SummaryStat label="Negative" value={counts.negative} variant="warning" />
          <SummaryStat label="Unclassified" value={counts.unclassified} variant="default" />
          <div className={styles.totalCell}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalValue}>{counts.total}</span>
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <ul className={styles.candidateList}>
          {scenario.candidates.map((c) => {
            const selected = decisions[c.text];
            return (
              <li key={c.text} className={styles.candidateItem} data-selected={selected ?? 'none'}>
                <div className={styles.candidateMain}>
                  <div className={styles.keywordText}>{c.text}</div>
                  <div className={styles.metricsRow}>
                    <span className={styles.metricChip}>
                      <span className={styles.metricLabel}>Relevance</span>
                      <span className={styles.metricValue}>{formatProxy(c.relevance)}%</span>
                    </span>
                    <span className={styles.metricChip}>
                      <span className={styles.metricLabel}>Volume</span>
                      <span className={styles.metricValue}>{formatProxy(c.searchVolumeProxy)}%</span>
                    </span>
                    <span className={styles.metricChip}>
                      <span className={styles.metricLabel}>Competition</span>
                      <span className={styles.metricValue}>{formatProxy(c.competitionProxy)}%</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    className={styles.notesInput}
                    placeholder="Optional note (e.g. why you flagged it as negative)"
                    value={notes[c.text] ?? ''}
                    onChange={(e) => setNote(c.text, e.target.value)}
                    maxLength={140}
                  />
                </div>
                <div className={styles.priorityGroup} role="radiogroup" aria-label={`Priority for ${c.text}`}>
                  {PRIORITIES.map((p) => {
                    const isSelected = selected === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setPriority(c.text, p)}
                        className={`${styles.priorityBtn} ${isSelected ? styles[`priority${p}`] : ''}`}
                      >
                        {PRIORITY_LABEL[p]}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.submitRow}>
        <Button onClick={persistAndSubmit} variant="primary" disabled={pending}>
          {pending ? 'Grading…' : 'Submit categorization'}
        </Button>
        <p className={styles.hint}>
          Tip: relevance + volume is a starting heuristic, not a rule. A high-volume keyword
          that&apos;s only 5% relevant to the product is a negative, not a primary.
        </p>
      </div>
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
