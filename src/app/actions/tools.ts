/**
 * Tool session server actions — start, save, submit.
 *
 * One action per tool. Sessions stored in `ToolSession` (Prisma) with
 * `state` as a JSON column.
 *
 * Pattern:
 *   - startToolSession(toolType, scenarioId) → returns sessionId
 *   - saveToolSession(sessionId, stateJson)  → upserts state
 *   - submitToolSession(sessionId)           → grades, stores result, returns grade
 */

'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createSafeAction } from '@/lib/validation';
import { type ToolType } from '@/lib/enums';
import { evaluateBadges } from '@/lib/badges';
import { awardXpOnce } from '@/lib/xp';
import { isUniqueConstraintError } from '@/lib/prisma-errors';

/** XP granted for a passing tool submission. */
const TOOL_PASS_XP = 30;

interface ToolGrade {
  totalScore: number;
  passed: boolean;
  criteriaResults: unknown[];
  overallFeedback: string;
}

import { gradeCampaignDraft } from '@/engine/campaign-builder/engine';
import { getScenarioById as getCbScenario } from '@/engine/campaign-builder/scenarios';

import { gradeBidDecisions } from '@/engine/bid-elevator/engine';
import { getScenarioById as getBeScenario } from '@/engine/bid-elevator/scenarios';

import { gradeStrDecisions } from '@/engine/str-triage/engine';
import { getScenarioById as getStrScenario } from '@/engine/str-triage/scenarios';

import { gradeListingAudit } from '@/engine/listing-audit/engine';
import { getScenarioById as getLaScenario } from '@/engine/listing-audit/scenarios';

import { gradeKeywordResearch } from '@/engine/keyword-research/engine';
import { getScenarioById as getKrScenario } from '@/engine/keyword-research/scenarios';

import type { CampaignBuilderSessionState } from '@/engine/campaign-builder/types';
import type { BidElevatorSessionState } from '@/engine/bid-elevator/types';
import type { StrTriageSessionState } from '@/engine/str-triage/types';
import type { ListingAuditSessionState } from '@/engine/listing-audit/types';
import type { KeywordResearchSessionState } from '@/engine/keyword-research/types';

// ---------------------------------------------------------------------------
// startToolSession
// ---------------------------------------------------------------------------

const startSessionSchema = z.object({
  toolType: z.enum(['CAMPAIGN_BUILDER', 'BID_ELEVATOR', 'STR_TRIAGE', 'LISTING_AUDIT', 'KEYWORD_RESEARCH']),
  scenarioId: z.string().min(1),
});

export const startToolSession = createSafeAction(startSessionSchema, async (data) => {
  const user = await requireAuth();

  const session = await db.toolSession.create({
    data: {
      userId: user.id,
      toolType: data.toolType as ToolType,
      scenarioId: data.scenarioId,
      status: 'IN_PROGRESS',
      state: JSON.stringify({ scenarioId: data.scenarioId, hintsUsed: 0, startedAt: new Date().toISOString() }),
    },
  });

  return { sessionId: session.id };
});

// ---------------------------------------------------------------------------
// saveToolSession
// ---------------------------------------------------------------------------

const saveSessionSchema = z.object({
  sessionId: z.string().min(1),
  state: z.record(z.string(), z.unknown()),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

export const saveToolSession = createSafeAction(saveSessionSchema, async (data) => {
  const user = await requireAuth();
  const session = await db.toolSession.findUnique({ where: { id: data.sessionId } });
  if (!session) throw new Error('Session not found.');
  if (session.userId !== user.id) throw new Error('Forbidden.');

  // H3: once a session is submitted/graded its stored state is frozen, so it
  // stays consistent with the recorded grade. The status guard lives in the
  // updateMany where-clause so the check and the write are one atomic
  // operation: a submit that lands between a plain read and update can no
  // longer let a late save overwrite the graded state.
  const saved = await db.toolSession.updateMany({
    where: { id: data.sessionId, userId: user.id, status: 'IN_PROGRESS' },
    data: {
      state: JSON.stringify(data.state),
      timeSpentSeconds: data.timeSpentSeconds ?? session.timeSpentSeconds,
    },
  });
  if (saved.count !== 1) {
    throw new Error('This session has been submitted and can no longer be edited.');
  }

  return { savedAt: new Date().toISOString() };
});

// ---------------------------------------------------------------------------
// submitToolSession — grades the session
// ---------------------------------------------------------------------------

const submitSessionSchema = z.object({
  sessionId: z.string().min(1),
  state: z.record(z.string(), z.unknown()),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

export const submitToolSession = createSafeAction(submitSessionSchema, async (data) => {
  const user = await requireAuth();
  const session = await db.toolSession.findUnique({ where: { id: data.sessionId } });
  if (!session) throw new Error('Session not found.');
  if (session.userId !== user.id) throw new Error('Forbidden.');

  const scenarioId = session.scenarioId;
  if (!scenarioId) throw new Error('No scenario associated with this session.');

  // The request that transitions the session out of IN_PROGRESS is the single
  // writer of its terminal status, state, score, and (on a pass) XP. Any other
  // request reconciles from the recorded terminal state instead. This keeps
  // the grade, the stored state, and the XP consistent under concurrency and
  // makes submit safely retriable after a mid-grade crash (H3).
  let grade: ToolGrade;
  let xpAwarded = 0;

  if (session.status === 'IN_PROGRESS') {
    // Grade BEFORE any write — a bad scenario or malformed state throws here
    // and leaves the session IN_PROGRESS and retriable.
    grade = gradeToolSession(session.toolType, scenarioId, data.state);
    const passed = grade.passed;

    let wonTransition = false;
    try {
      wonTransition = await db.$transaction(async (tx) => {
        const claim = await tx.toolSession.updateMany({
          where: { id: data.sessionId, userId: user.id, status: 'IN_PROGRESS' },
          data: {
            state: JSON.stringify(data.state),
            status: passed ? 'GRADED' : 'SUBMITTED',
            score: grade.totalScore,
            submittedAt: new Date(),
            timeSpentSeconds: data.timeSpentSeconds ?? session.timeSpentSeconds,
          },
        });
        // Lost the race: a concurrent submit already made the session
        // terminal. Award nothing and reconcile from the recorded state below.
        if (claim.count !== 1) return false;

        if (passed) {
          // Only the winner writes XP, and only for a recorded pass. The
          // ledger's unique key keeps it exactly-once even against a replay.
          await tx.xpLedger.create({
            data: {
              userId: user.id,
              eventKey: `tool-pass:${data.sessionId}`,
              amount: TOOL_PASS_XP,
              reason: 'Tool practice passed',
            },
          });
          await tx.user.update({
            where: { id: user.id },
            data: { xp: { increment: TOOL_PASS_XP }, lastActiveAt: new Date() },
          });
        } else {
          await tx.user.update({
            where: { id: user.id },
            data: { lastActiveAt: new Date() },
          });
        }
        return true;
      });
    } catch (e) {
      if (!isUniqueConstraintError(e)) throw e;
      wonTransition = false;
    }

    if (wonTransition) {
      xpAwarded = passed ? TOOL_PASS_XP : 0;
    } else {
      // Reconcile from whatever the winner recorded.
      ({ grade, xpAwarded } = await reconcileTerminalSession(data.sessionId, user.id, scenarioId));
    }
  } else {
    // Session was already terminal on read — reconcile, never re-mutate.
    ({ grade, xpAwarded } = await reconcileTerminalSession(data.sessionId, user.id, scenarioId));
  }

  // Badge trigger fires only on a passing submission — the only criteria that
  // references tool_sessions needs graded (passed) runs.
  const badgeResult = grade.passed
    ? await evaluateBadges(user.id, {
        trigger: 'tool_submit',
        toolType: session.toolType,
        passed: true,
      })
    : { awarded: [], totalXpGained: 0 };

  return {
    sessionId: data.sessionId,
    totalScore: grade.totalScore,
    passed: grade.passed,
    criteriaResults: grade.criteriaResults as Array<{ criterionId: string; passed: boolean; score: number; feedback: string }>,
    overallFeedback: grade.overallFeedback,
    newlyAwardedBadges: badgeResult.awarded,
    xpAwarded,
  };
});

/**
 * Grade a session from its RECORDED terminal state and reconcile XP. Used when
 * this request did not win the status transition (session already terminal, or
 * a concurrent submit won the race). The response reflects what was stored, and
 * XP is (idempotently) ensured only when the recorded status is GRADED.
 */
async function reconcileTerminalSession(
  sessionId: string,
  userId: string,
  scenarioId: string,
): Promise<{ grade: ToolGrade; xpAwarded: number }> {
  const terminal = await db.toolSession.findUnique({ where: { id: sessionId } });
  if (!terminal) throw new Error('Session not found.');
  const grade = gradeToolSession(terminal.toolType, scenarioId, parseState(terminal.state));

  let xpAwarded = 0;
  if (terminal.status === 'GRADED') {
    // awardXpOnce is idempotent: it grants only if the winner hasn't already.
    const granted = await awardXpOnce(
      userId,
      `tool-pass:${sessionId}`,
      TOOL_PASS_XP,
      'Tool practice passed',
    );
    xpAwarded = granted ? TOOL_PASS_XP : 0;
  }
  return { grade, xpAwarded };
}

/**
 * Parse a stored session-state JSON blob. Returns `{}` on malformed JSON so
 * grading fails closed (zero score) rather than throwing on a corrupt row.
 */
function parseState(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Pure grading dispatch. Selects the scenario + engine for the tool type and
 * returns the grade. No database writes — callers own persistence so grading
 * can be repeated safely.
 */
function gradeToolSession(
  toolType: string,
  scenarioId: string,
  state: Record<string, unknown>,
): ToolGrade {
  if (toolType === 'CAMPAIGN_BUILDER') {
    const scenario = getCbScenario(scenarioId);
    if (!scenario) throw new Error('Scenario not found.');
    const s = state as unknown as CampaignBuilderSessionState;
    return gradeCampaignDraft(s.draft, scenario);
  }
  if (toolType === 'BID_ELEVATOR') {
    const scenario = getBeScenario(scenarioId);
    if (!scenario) throw new Error('Scenario not found.');
    const s = state as unknown as BidElevatorSessionState;
    return gradeBidDecisions(scenario, s.decisions);
  }
  if (toolType === 'STR_TRIAGE') {
    const scenario = getStrScenario(scenarioId);
    if (!scenario) throw new Error('Scenario not found.');
    const s = state as unknown as StrTriageSessionState;
    return gradeStrDecisions(scenario, s.decisions);
  }
  if (toolType === 'LISTING_AUDIT') {
    const scenario = getLaScenario(scenarioId);
    if (!scenario) throw new Error('Scenario not found.');
    const s = state as unknown as ListingAuditSessionState;
    return gradeListingAudit(scenario, s.findings, s.revisedListing);
  }
  if (toolType === 'KEYWORD_RESEARCH') {
    const scenario = getKrScenario(scenarioId);
    if (!scenario) throw new Error('Scenario not found.');
    const s = state as unknown as KeywordResearchSessionState;
    return gradeKeywordResearch(scenario, s.decisions, s.negatives);
  }
  throw new Error(`Unknown tool type: ${toolType}`);
}

// ---------------------------------------------------------------------------
// Helper: load a session's state for resume
// ---------------------------------------------------------------------------

export async function loadToolSession(sessionId: string): Promise<unknown | null> {
  const user = await requireAuth();
  const session = await db.toolSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) return null;
  try {
    return JSON.parse(session.state);
  } catch {
    return null;
  }
}