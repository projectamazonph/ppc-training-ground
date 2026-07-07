'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { submitToolSession, saveToolSession } from '@/app/actions/tools';
import type {
  CampaignBuilderScenario,
  CampaignDraft,
  CampaignType,
  TargetingType,
  BidStrategy,
  MatchType,
  BtvAudienceCategory,
  CampaignBuilderSessionState,
  WizardStep,
} from '@/engine/campaign-builder/types';
import { ToolResult } from './ToolResult';
import styles from './CampaignBuilderRunner.module.css';

interface CampaignBuilderRunnerProps {
  sessionId: string;
  scenario: CampaignBuilderScenario;
  toolSlug: string;
}

const CAMPAIGN_TYPES: { value: CampaignType; label: string; description: string }[] = [
  {
    value: 'SPONSORED_PRODUCTS',
    label: 'Sponsored Products',
    description: 'Keyword + product targeting. The Amazon default.',
  },
  {
    value: 'SPONSORED_BRANDS',
    label: 'Sponsored Brands',
    description: 'Top-of-search banner with brand creative.',
  },
  {
    value: 'SPONSORED_DISPLAY',
    label: 'Sponsored Display',
    description: 'On-Amazon + off-Amazon display ads, audience + product targeting.',
  },
  {
    value: 'SPONSORED_TV',
    label: 'Sponsored TV',
    description: 'Prime Video, Twitch, streaming apps. CPM-based, audience targeting.',
  },
];

const TARGETING_TYPES: { value: TargetingType; label: string }[] = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'AUTO', label: 'Auto' },
  { value: 'AUDIENCE', label: 'Audience' },
];

const BID_STRATEGIES: BidStrategy[] = [
  'LEGACY',
  'DYNAMIC_BIDS_DOWN_ONLY',
  'DYNAMIC_BIDS_UP_AND_DOWN',
  'FIXED_BIDS',
  'CPM_FIXED',
  'CPM_DYNAMIC',
];

const MATCH_TYPES: MatchType[] = ['BROAD', 'PHRASE', 'EXACT'];

const BTV_AUDIENCES: BtvAudienceCategory[] = [
  'IN_MARKET',
  'LIFESTYLE',
  'INTERESTS',
  'LOOKALIKE',
  'CONTEXTUAL',
];

function isBtv(draft: CampaignDraft): boolean {
  return draft.campaignType === 'SPONSORED_TV';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inThirtyDaysIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function emptyDraft(): CampaignDraft {
  return {
    name: '',
    campaignType: 'SPONSORED_PRODUCTS',
    portfolioId: null,
    startDate: todayIso(),
    endDate: null,
    dailyBudget: 1000,
    targetingType: 'MANUAL',
    bidStrategy: 'DYNAMIC_BIDS_DOWN_ONLY',
    defaultBid: 50,
    adGroupName: 'Ad Group 1',
    keywords: [],
    productTargets: [],
    audiences: [],
  };
}

export function CampaignBuilderRunner({ sessionId, scenario, toolSlug }: CampaignBuilderRunnerProps) {
  const [draft, setDraft] = useState<CampaignDraft>(emptyDraft);
  const [step, setStep] = useState<WizardStep>('campaign');
  const [result, setResult] = useState<{
    totalScore: number;
    passed: boolean;
    overallFeedback: string;
    criteriaResults: Array<{ criterionId: string; passed: boolean; score: number; feedback: string }>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const btv = isBtv(draft);
  const allowedTypes = scenario.constraints.allowedCampaignTypes;
  const allowedStrategies = scenario.constraints.allowedBidStrategies;

  // Step sequence adapts to BTV.
  const steps: { id: WizardStep; label: string }[] = useMemo(
    () => [
      { id: 'campaign', label: 'Campaign' },
      { id: 'bidding', label: 'Bidding' },
      { id: 'adgroup', label: 'Ad group' },
      ...(btv
        ? [{ id: 'audiences' as WizardStep, label: 'Audiences' }]
        : [{ id: 'targets' as WizardStep, label: 'Targets' }]),
      { id: 'review', label: 'Review' },
    ],
    [btv],
  );

  const currentIdx = steps.findIndex((s) => s.id === step);
  const canGoNext = useMemo(() => validateStep(draft, step, scenario), [draft, step, scenario]);

  function setDraftField<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setCampaignType(t: CampaignType) {
    setDraft((prev) => {
      const isSwitchingToBtv = t === 'SPONSORED_TV' && prev.campaignType !== 'SPONSORED_TV';
      const isSwitchingFromBtv = t !== 'SPONSORED_TV' && prev.campaignType === 'SPONSORED_TV';
      const next: CampaignDraft = {
        ...prev,
        campaignType: t,
        // Reset bid strategy to a sensible default for the campaign type.
        bidStrategy: t === 'SPONSORED_TV' ? 'CPM_FIXED' : 'DYNAMIC_BIDS_DOWN_ONLY',
        // Wipe irrelevant fields when switching.
        ...(isSwitchingToBtv ? { keywords: [], productTargets: [] } : {}),
        ...(isSwitchingFromBtv ? { audiences: [] } : {}),
        // BTV uses audience targeting, not manual/auto.
        targetingType: t === 'SPONSORED_TV' ? 'AUDIENCE' : prev.targetingType,
      };
      return next;
    });
  }

  function addKeyword() {
    setDraft((prev) => ({
      ...prev,
      keywords: [
        ...prev.keywords,
        { id: `k${Date.now()}`, text: '', matchType: 'PHRASE', bid: prev.defaultBid },
      ],
    }));
  }

  function updateKeyword(idx: number, patch: { text?: string; matchType?: MatchType; bid?: number }) {
    setDraft((prev) => {
      const next = [...prev.keywords];
      const current = next[idx];
      if (!current) return prev;
      next[idx] = {
        id: current.id,
        text: patch.text ?? current.text,
        matchType: patch.matchType ?? current.matchType,
        bid: patch.bid ?? current.bid,
      };
      return { ...prev, keywords: next };
    });
  }

  function removeKeyword(idx: number) {
    setDraft((prev) => ({ ...prev, keywords: prev.keywords.filter((_, i) => i !== idx) }));
  }

  function addProductTarget() {
    setDraft((prev) => ({
      ...prev,
      productTargets: [
        ...prev.productTargets,
        { id: `pt${Date.now()}`, asin: '', bid: prev.defaultBid },
      ],
    }));
  }

  function updateProductTarget(idx: number, patch: { asin?: string; bid?: number }) {
    setDraft((prev) => {
      const next = [...prev.productTargets];
      const current = next[idx];
      if (!current) return prev;
      next[idx] = {
        id: current.id,
        asin: patch.asin ?? current.asin,
        bid: patch.bid ?? current.bid,
      };
      return { ...prev, productTargets: next };
    });
  }

  function removeProductTarget(idx: number) {
    setDraft((prev) => ({
      ...prev,
      productTargets: prev.productTargets.filter((_, i) => i !== idx),
    }));
  }

  function addAudience() {
    setDraft((prev) => ({
      ...prev,
      audiences: [
        ...prev.audiences,
        { category: 'IN_MARKET', details: {} },
      ],
    }));
  }

  function updateAudience(idx: number, patch: { category?: BtvAudienceCategory; details?: Record<string, string> }) {
    setDraft((prev) => {
      const next = [...prev.audiences];
      const current = next[idx];
      if (!current) return prev;
      next[idx] = {
        category: patch.category ?? current.category,
        details: patch.details ?? current.details,
      };
      return { ...prev, audiences: next };
    });
  }

  function removeAudience(idx: number) {
    setDraft((prev) => ({ ...prev, audiences: prev.audiences.filter((_, i) => i !== idx) }));
  }

  async function persistAndSubmit() {
    setError(null);
    if (!canGoNext.valid && currentIdx === steps.length - 1) {
      setError(canGoNext.error ?? 'Fill in the missing fields before submitting.');
      return;
    }
    startTransition(async () => {
      const state: CampaignBuilderSessionState = {
        scenarioId: scenario.id,
        currentStep: 'review',
        hintsUsed: 0,
        startedAt: new Date().toISOString(),
        draft,
        completedAt: new Date().toISOString(),
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
          <Badge variant="info">Brief</Badge>
          <CardTitle>{scenario.product.name}</CardTitle>
          <CardDescription>{scenario.brief}</CardDescription>
        </CardHeader>
        <p className={styles.allowedNote}>
          <strong>Allowed campaign types:</strong>{' '}
          {allowedTypes.map((t) => CAMPAIGN_TYPES.find((c) => c.value === t)?.label ?? t).join(' · ')}
          <br />
          <strong>Allowed bid strategies:</strong> {allowedStrategies.join(' · ')}
        </p>
      </Card>

      <ol className={styles.stepper}>
        {steps.map((s, i) => {
          const isCurrent = s.id === step;
          const isComplete = i < currentIdx;
          return (
            <li
              key={s.id}
              className={styles.stepperItem}
              data-state={isCurrent ? 'current' : isComplete ? 'complete' : 'pending'}
            >
              <span className={styles.stepperNum}>{i + 1}</span>
              <span className={styles.stepperLabel}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {step === 'campaign' && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Step 1 — Campaign settings</CardTitle>
            <CardDescription>
              Name the campaign, pick a type, set dates and budget.
            </CardDescription>
          </CardHeader>
          <div className={styles.formGrid}>
            <label className={styles.fullWidth}>
              <span>Campaign name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraftField('name', e.target.value)}
                placeholder="e.g. Bamboo Cutting Board — Exact Match"
                maxLength={120}
              />
            </label>

            <fieldset className={`${styles.fullWidth} ${styles.typeGroup}`}>
              <legend>Campaign type</legend>
              <div className={styles.typeCards}>
                {CAMPAIGN_TYPES.map((t) => {
                  const allowed = allowedTypes.includes(t.value);
                  const selected = draft.campaignType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      className={styles.typeCard}
                      data-selected={selected}
                      onClick={() => allowed && setCampaignType(t.value)}
                      disabled={!allowed}
                    >
                      <div className={styles.typeName}>{t.label}</div>
                      <div className={styles.typeDesc}>{t.description}</div>
                      {!allowed && <div className={styles.typeDisabled}>Not in scenario</div>}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label>
              <span>Start date</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraftField('startDate', e.target.value)}
              />
            </label>

            <label>
              <span>End date {scenario.constraints.requireEndDate && <em>(required)</em>}</span>
              <input
                type="date"
                value={draft.endDate ?? ''}
                onChange={(e) =>
                  setDraftField('endDate', e.target.value === '' ? null : e.target.value)
                }
                min={draft.startDate}
              />
            </label>

            <label>
              <span>Daily budget (₱)</span>
              <input
                type="number"
                min={scenario.constraints.minDailyBudget}
                max={scenario.constraints.maxDailyBudget}
                step={50}
                value={draft.dailyBudget}
                onChange={(e) => setDraftField('dailyBudget', Math.max(0, Number(e.target.value)))}
              />
              <small className={styles.fieldHint}>
                Allowed: ₱{scenario.constraints.minDailyBudget.toLocaleString('en-PH')} – ₱
                {scenario.constraints.maxDailyBudget.toLocaleString('en-PH')}
              </small>
            </label>

            {!btv && (
              <label>
                <span>Targeting type</span>
                <select
                  value={draft.targetingType}
                  onChange={(e) => setDraftField('targetingType', e.target.value as TargetingType)}
                >
                  {TARGETING_TYPES.filter((t) => t.value !== 'AUDIENCE').map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </Card>
      )}

      {step === 'bidding' && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Step 2 — Bidding</CardTitle>
            <CardDescription>
              {btv
                ? 'BTV is CPM-based. Pick a fixed bid or let Amazon optimize.'
                : 'Pick a bidding strategy and set the default bid.'}
            </CardDescription>
          </CardHeader>
          <div className={styles.formGrid}>
            <label>
              <span>Bid strategy</span>
              <select
                value={draft.bidStrategy}
                onChange={(e) => setDraftField('bidStrategy', e.target.value as BidStrategy)}
              >
                {BID_STRATEGIES.filter((s) => allowedStrategies.includes(s)).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Default {btv ? 'CPM' : 'bid'} (₱)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={draft.defaultBid}
                onChange={(e) => setDraftField('defaultBid', Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
        </Card>
      )}

      {step === 'adgroup' && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Step 3 — Ad group</CardTitle>
            <CardDescription>
              Single ad group for now. Multi-ad-group is a Sprint 5+ feature.
            </CardDescription>
          </CardHeader>
          <label>
            <span>Ad group name</span>
            <input
              type="text"
              value={draft.adGroupName}
              onChange={(e) => setDraftField('adGroupName', e.target.value)}
              maxLength={80}
            />
          </label>
        </Card>
      )}

      {step === 'targets' && !btv && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Step 4 — Targets</CardTitle>
            <CardDescription>
              Add at least {scenario.constraints.minKeywords} keyword
              {scenario.constraints.minKeywords === 1 ? '' : 's'} and at least{' '}
              {scenario.constraints.minProductTargets} product target
              {scenario.constraints.minProductTargets === 1 ? '' : 's'}.
            </CardDescription>
          </CardHeader>
          <section>
            <h4 className={styles.subHeader}>
              Keywords ({draft.keywords.length}
              {scenario.constraints.minKeywords > 0 && ` / min ${scenario.constraints.minKeywords}`})
            </h4>
            {draft.keywords.map((k, i) => (
              <div key={k.id} className={styles.kwRow}>
                <input
                  type="text"
                  value={k.text}
                  onChange={(e) => updateKeyword(i, { text: e.target.value })}
                  placeholder="keyword"
                  className={styles.kwText}
                />
                <select
                  value={k.matchType}
                  onChange={(e) => updateKeyword(i, { matchType: e.target.value as MatchType })}
                >
                  {MATCH_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={k.bid}
                  onChange={(e) => updateKeyword(i, { bid: Math.max(0, Number(e.target.value)) })}
                  className={styles.kwBid}
                  aria-label="Keyword bid"
                />
                <button
                  type="button"
                  onClick={() => removeKeyword(i)}
                  className={styles.removeBtn}
                  aria-label="Remove keyword"
                >
                  <Icon name="X" size="sm" />
                </button>
              </div>
            ))}
            <Button type="button" onClick={addKeyword} variant="ghost" size="sm">
              <Icon name="Plus" size="sm" /> Add keyword
            </Button>
          </section>

          <section className={styles.productTargetSection}>
            <h4 className={styles.subHeader}>
              Product targets ({draft.productTargets.length}
              {scenario.constraints.minProductTargets > 0 &&
                ` / min ${scenario.constraints.minProductTargets}`}
              )
            </h4>
            {draft.productTargets.map((pt, i) => (
              <div key={pt.id} className={styles.kwRow}>
                <input
                  type="text"
                  value={pt.asin}
                  onChange={(e) => updateProductTarget(i, { asin: e.target.value })}
                  placeholder="ASIN (B0XXXXXXX)"
                  className={styles.kwText}
                />
                <span className={styles.asinSpacer}>ASIN</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={pt.bid}
                  onChange={(e) =>
                    updateProductTarget(i, { bid: Math.max(0, Number(e.target.value)) })
                  }
                  className={styles.kwBid}
                  aria-label="Product target bid"
                />
                <button
                  type="button"
                  onClick={() => removeProductTarget(i)}
                  className={styles.removeBtn}
                  aria-label="Remove product target"
                >
                  <Icon name="X" size="sm" />
                </button>
              </div>
            ))}
            <Button type="button" onClick={addProductTarget} variant="ghost" size="sm">
              <Icon name="Plus" size="sm" /> Add product target
            </Button>
          </section>
        </Card>
      )}

      {step === 'audiences' && btv && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Step 4 — Audiences</CardTitle>
            <CardDescription>
              Add at least {scenario.constraints.minAudienceSegments ?? 2} audience segment
              {(scenario.constraints.minAudienceSegments ?? 2) === 1 ? '' : 's'}. BTV uses
              audience targeting only — no keywords or product targets.
            </CardDescription>
          </CardHeader>
          {draft.audiences.map((a, i) => (
            <div key={i} className={styles.audienceRow}>
              <label>
                <span>Category</span>
                <select
                  value={a.category}
                  onChange={(e) =>
                    updateAudience(i, { category: e.target.value as BtvAudienceCategory })
                  }
                >
                  {BTV_AUDIENCES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => removeAudience(i)}
                className={styles.removeBtn}
                aria-label="Remove audience"
              >
                <Icon name="X" size="sm" />
              </button>
            </div>
          ))}
          <Button type="button" onClick={addAudience} variant="ghost" size="sm">
            <Icon name="Plus" size="sm" /> Add audience
          </Button>
        </Card>
      )}

      {step === 'review' && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Step 5 — Review</CardTitle>
            <CardDescription>
              Check the campaign before submitting. The engine compares your draft against the
              reference answer for this scenario.
            </CardDescription>
          </CardHeader>
          <dl className={styles.reviewList}>
            <div>
              <dt>Name</dt>
              <dd>{draft.name || <em>(empty)</em>}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{draft.campaignType}</dd>
            </div>
            <div>
              <dt>Start → End</dt>
              <dd>
                {draft.startDate} → {draft.endDate ?? 'ongoing'}
              </dd>
            </div>
            <div>
              <dt>Daily budget</dt>
              <dd>₱{draft.dailyBudget.toLocaleString('en-PH')}</dd>
            </div>
            <div>
              <dt>Targeting</dt>
              <dd>{draft.targetingType}</dd>
            </div>
            <div>
              <dt>Bid strategy</dt>
              <dd>{draft.bidStrategy}</dd>
            </div>
            <div>
              <dt>Default {btv ? 'CPM' : 'bid'}</dt>
              <dd>₱{draft.defaultBid.toLocaleString('en-PH')}</dd>
            </div>
            <div>
              <dt>Ad group</dt>
              <dd>{draft.adGroupName}</dd>
            </div>
            {!btv && (
              <>
                <div>
                  <dt>Keywords</dt>
                  <dd>
                    {draft.keywords.length === 0
                      ? <em>(none)</em>
                      : draft.keywords.map((k) => (
                          <div key={k.id} className={styles.reviewChip}>
                            <code>{k.text || '(empty)'}</code> · {k.matchType} · ₱{k.bid}
                          </div>
                        ))}
                  </dd>
                </div>
                <div>
                  <dt>Product targets</dt>
                  <dd>
                    {draft.productTargets.length === 0
                      ? <em>(none)</em>
                      : draft.productTargets.map((pt) => (
                          <div key={pt.id} className={styles.reviewChip}>
                            <code>{pt.asin || '(empty)'}</code> · ₱{pt.bid}
                          </div>
                        ))}
                  </dd>
                </div>
              </>
            )}
            {btv && (
              <div>
                <dt>Audiences</dt>
                <dd>
                  {draft.audiences.length === 0
                    ? <em>(none)</em>
                    : draft.audiences.map((a, i) => (
                        <div key={i} className={styles.reviewChip}>
                          {a.category}
                        </div>
                      ))}
                </dd>
              </div>
            )}
          </dl>
          {!canGoNext.valid && (
            <p className={styles.reviewError}>
              <Icon name="Warning" size="sm" /> {canGoNext.error}
            </p>
          )}
        </Card>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.navRow}>
        <Button
          variant="secondary"
          onClick={() => {
            const prev = steps[Math.max(0, currentIdx - 1)];
            if (prev) setStep(prev.id);
          }}
          disabled={currentIdx === 0}
        >
          ← Back
        </Button>
        {currentIdx < steps.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => {
              const next = steps[currentIdx + 1];
              if (next) setStep(next.id);
            }}
            disabled={!canGoNext.valid}
            title={!canGoNext.valid ? canGoNext.error : undefined}
          >
            Next →
          </Button>
        ) : (
          <Button variant="primary" onClick={persistAndSubmit} disabled={pending || !canGoNext.valid}>
            {pending ? 'Grading…' : 'Submit campaign'}
          </Button>
        )}
      </div>
    </div>
  );
}

function validateStep(
  draft: CampaignDraft,
  step: WizardStep,
  scenario: CampaignBuilderScenario,
): { valid: boolean; error?: string } {
  switch (step) {
    case 'campaign': {
      if (!draft.name.trim()) return { valid: false, error: 'Campaign name is required.' };
      if (!draft.startDate) return { valid: false, error: 'Start date is required.' };
      if (scenario.constraints.requireEndDate && !draft.endDate) {
        return { valid: false, error: 'End date is required for this scenario.' };
      }
      if (draft.endDate && draft.endDate <= draft.startDate) {
        return { valid: false, error: 'End date must be after start date.' };
      }
      if (draft.dailyBudget < scenario.constraints.minDailyBudget) {
        return {
          valid: false,
          error: `Daily budget must be at least ₱${scenario.constraints.minDailyBudget.toLocaleString('en-PH')}.`,
        };
      }
      if (draft.dailyBudget > scenario.constraints.maxDailyBudget) {
        return {
          valid: false,
          error: `Daily budget cannot exceed ₱${scenario.constraints.maxDailyBudget.toLocaleString('en-PH')}.`,
        };
      }
      return { valid: true };
    }
    case 'bidding':
      if (draft.defaultBid <= 0) return { valid: false, error: 'Default bid must be > 0.' };
      return { valid: true };
    case 'adgroup':
      if (!draft.adGroupName.trim()) return { valid: false, error: 'Ad group name is required.' };
      return { valid: true };
    case 'targets': {
      if (draft.keywords.length < scenario.constraints.minKeywords) {
        return {
          valid: false,
          error: `Add at least ${scenario.constraints.minKeywords} keyword(s).`,
        };
      }
      if (draft.productTargets.length < scenario.constraints.minProductTargets) {
        return {
          valid: false,
          error: `Add at least ${scenario.constraints.minProductTargets} product target(s).`,
        };
      }
      const hasEmptyKw = draft.keywords.some((k) => !k.text.trim());
      if (hasEmptyKw) return { valid: false, error: 'Some keywords are empty.' };
      const hasEmptyPt = draft.productTargets.some((pt) => !pt.asin.trim());
      if (hasEmptyPt) return { valid: false, error: 'Some product targets are empty.' };
      return { valid: true };
    }
    case 'audiences': {
      const minAud = scenario.constraints.minAudienceSegments ?? 0;
      if (draft.audiences.length < minAud) {
        return { valid: false, error: `Add at least ${minAud} audience segment(s).` };
      }
      return { valid: true };
    }
    case 'review':
      return { valid: true };
  }
}
