'use client';

import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { submitToolSession, saveToolSession } from '@/app/actions/tools';
import type { ListingAuditScenario, ListingDraft, ListingAuditFinding } from '@/engine/listing-audit/types';
import type { ListingAuditSessionState } from '@/engine/listing-audit/types';
import { ToolResult } from './ToolResult';
import styles from './ListingAuditRunner.module.css';

interface ListingAuditRunnerProps {
  sessionId: string;
  scenario: ListingAuditScenario;
  toolSlug: string;
}

const FINDING_FIELDS: ListingAuditFinding['field'][] = [
  'title',
  'bullets',
  'description',
  'images',
  'aplus',
  'pricing',
  'reviews',
];

const SEVERITY_LABEL: Record<ListingAuditFinding['severity'], string> = {
  good: 'Looks good',
  warning: 'Needs work',
  critical: 'Critical issue',
};

const SEVERITY_ICON: Record<ListingAuditFinding['severity'], 'Check' | 'Warning' | 'X'> = {
  good: 'Check',
  warning: 'Warning',
  critical: 'X',
};

export function ListingAuditRunner({ sessionId, scenario, toolSlug }: ListingAuditRunnerProps) {
  const [current, setCurrent] = useState<ListingDraft>(scenario.currentListing);
  const [checkedFields, setCheckedFields] = useState<Set<ListingAuditFinding['field']>>(
    new Set(),
  );
  const [result, setResult] = useState<{
    totalScore: number;
    passed: boolean;
    overallFeedback: string;
    criteriaResults: Array<{ criterionId: string; passed: boolean; score: number; feedback: string }>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const findingsByField = new Map(scenario.referenceFindings.map((f) => [f.field, f] as const));

  function toggleCheck(field: ListingAuditFinding['field']) {
    setCheckedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function update<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) {
    setCurrent((prev) => ({ ...prev, [key]: value }));
  }

  function updateBullet(idx: number, value: string) {
    setCurrent((prev) => {
      const next = [...prev.bullets];
      next[idx] = value;
      return { ...prev, bullets: next };
    });
  }

  function addBullet() {
    setCurrent((prev) =>
      prev.bullets.length >= 5 ? prev : { ...prev, bullets: [...prev.bullets, ''] },
    );
  }

  function removeBullet(idx: number) {
    setCurrent((prev) => ({ ...prev, bullets: prev.bullets.filter((_, i) => i !== idx) }));
  }

  async function persistAndSubmit() {
    setError(null);
    startTransition(async () => {
      // Persist state via existing action (resume support).
      const findings: ListingAuditFinding[] = Array.from(checkedFields).map((field) => {
        const ref = findingsByField.get(field);
        return {
          field,
          severity: ref?.severity ?? 'warning',
          message: ref?.message ?? `Student flagged ${field}.`,
        };
      });
      const state: ListingAuditSessionState = {
        scenarioId: scenario.id,
        hintsUsed: 0,
        startedAt: new Date().toISOString(),
        findings,
        revisedListing: current,
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
      <Card padding="lg" className={styles.currentCard}>
        <CardHeader>
          <Badge variant="info">Current listing</Badge>
          <CardTitle>{scenario.product.name}</CardTitle>
          <CardDescription>
            {scenario.product.category} · ASIN {scenario.product.asin} · AOV ₱{scenario.product.aov.toLocaleString('en-PH')}
          </CardDescription>
        </CardHeader>
        <dl className={styles.listingPreview}>
          <div>
            <dt>Title</dt>
            <dd>{current.title || <em>(empty)</em>}</dd>
          </div>
          <div>
            <dt>Bullets ({current.bullets.length}/5)</dt>
            <dd>
              {current.bullets.length > 0 ? (
                <ul>
                  {current.bullets.map((b, i) => (
                    <li key={i}>{b || <em>(empty)</em>}</li>
                  ))}
                </ul>
              ) : (
                <em>(no bullets)</em>
              )}
            </dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{current.description || <em>(empty)</em>}</dd>
          </div>
          <div className={styles.metaRow}>
            <div>
              <dt>Images</dt>
              <dd>{current.imageCount}</dd>
            </div>
            <div>
              <dt>A+ content</dt>
              <dd>{current.hasAplusContent ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>₱{current.pricePhp.toLocaleString('en-PH')}</dd>
            </div>
            <div>
              <dt>Reviews</dt>
              <dd>
                {current.reviewCount} · {current.averageRating.toFixed(1)}★
              </dd>
            </div>
          </div>
        </dl>
      </Card>

      <Card padding="lg" className={styles.findingsCard}>
        <CardHeader>
          <CardTitle>Step 1 — flag the issues</CardTitle>
          <CardDescription>
            Check every field you think has a problem. The engine compares your selection against
            the reference findings.
          </CardDescription>
        </CardHeader>
        <ul className={styles.findingsList}>
          {FINDING_FIELDS.map((field) => {
            const finding = findingsByField.get(field);
            const severity = finding?.severity ?? 'good';
            const IconName = SEVERITY_ICON[severity];
            const checked = checkedFields.has(field);
            return (
              <li key={field} className={styles.findingItem} data-checked={checked} data-severity={severity}>
                <label className={styles.findingLabel}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheck(field)}
                    aria-label={`Flag ${field} as an issue`}
                  />
                  <span className={styles.findingIcon} data-severity={severity}>
                    <Icon name={IconName} size="sm" />
                  </span>
                  <div>
                    <div className={styles.findingField}>{field}</div>
                    <div className={styles.findingHint}>
                      {finding
                        ? `${SEVERITY_LABEL[severity]} — ${finding.message}`
                        : 'No issue'}
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card padding="lg" className={styles.revisionCard}>
        <CardHeader>
          <CardTitle>Step 2 — revise the listing</CardTitle>
          <CardDescription>
            Edit the fields you think need fixing. Leave the rest alone — the engine scores only
            what you change.
          </CardDescription>
        </CardHeader>
        <div className={styles.formGrid}>
          <label className={styles.fullWidth}>
            <span>Title</span>
            <input
              type="text"
              value={current.title}
              onChange={(e) => update('title', e.target.value)}
              maxLength={200}
            />
          </label>

          <div className={styles.fullWidth}>
            <span className={styles.bulletsLabel}>Bullets (up to 5)</span>
            {current.bullets.map((b, i) => (
              <div key={i} className={styles.bulletRow}>
                <input
                  type="text"
                  value={b}
                  onChange={(e) => updateBullet(i, e.target.value)}
                  placeholder={`Bullet ${i + 1}`}
                  maxLength={250}
                />
                <button
                  type="button"
                  onClick={() => removeBullet(i)}
                  className={styles.removeBtn}
                  aria-label={`Remove bullet ${i + 1}`}
                >
                  <Icon name="X" size="sm" />
                </button>
              </div>
            ))}
            {current.bullets.length < 5 && (
              <Button type="button" onClick={addBullet} variant="ghost" size="sm">
                <Icon name="Plus" size="sm" /> Add bullet
              </Button>
            )}
          </div>

          <label className={styles.fullWidth}>
            <span>Description</span>
            <textarea
              value={current.description}
              onChange={(e) => update('description', e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </label>

          <label>
            <span>Image count</span>
            <input
              type="number"
              min={0}
              max={9}
              value={current.imageCount}
              onChange={(e) => update('imageCount', Math.max(0, Math.min(9, Number(e.target.value))))}
            />
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={current.hasAplusContent}
              onChange={(e) => update('hasAplusContent', e.target.checked)}
            />
            <span>Has A+ content</span>
          </label>

          <label>
            <span>Price (₱)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={current.pricePhp}
              onChange={(e) => update('pricePhp', Math.max(0, Number(e.target.value)))}
            />
          </label>

          <label>
            <span>Review count</span>
            <input
              type="number"
              min={0}
              value={current.reviewCount}
              onChange={(e) => update('reviewCount', Math.max(0, Number(e.target.value)))}
            />
          </label>

          <label>
            <span>Average rating</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={current.averageRating}
              onChange={(e) =>
                update('averageRating', Math.max(0, Math.min(5, Number(e.target.value))))
              }
            />
          </label>
        </div>
      </Card>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.submitRow}>
        <Button onClick={persistAndSubmit} variant="primary" disabled={pending}>
          {pending ? 'Grading…' : 'Submit listing'}
        </Button>
        <p className={styles.hint}>
          Tip: the engine compares your selection against the reference findings. Mark the fields
          you think have real issues, then fix the ones you can.
        </p>
      </div>
    </div>
  );
}
