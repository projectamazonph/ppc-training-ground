/**
 * Search Term Triage scoring — deterministic checks against reference actions.
 */

import {
  aggregateGrade,
  binaryCriterion,
  gradedCriterion,
  type CriterionResult,
} from '../scoring';
import type {
  StrScenario,
  StrTriageGrade,
  StrDecision,
  StrAction,
} from './types';

/**
 * Score the student's triage decisions against the reference.
 */
export function gradeStrDecisions(
  scenario: StrScenario,
  decisions: StrDecision[]
): StrTriageGrade {
  const decisionMap = new Map(decisions.map((d) => [d.searchTermId, d]));

  let correctActionCount = 0;
  let totalScored = 0;

  const criteria: CriterionResult[] = [];

  for (const term of scenario.searchTerms) {
    const decision = decisionMap.get(term.id);
    if (!decision) continue;
    totalScored++;

    const refAction = scenario.referenceActions[term.id];
    if (!refAction) continue;

    if (decision.action === refAction) {
      correctActionCount++;

      // If action was optimize-bid, also check the bid adjustment is reasonable
      if (refAction === 'optimize-bid' && scenario.referenceBidAdjustments) {
        const refBid = scenario.referenceBidAdjustments[term.id];
        if (refBid !== undefined && decision.newBid !== undefined) {
          const bidDelta = Math.abs(decision.newBid - refBid) / Math.max(refBid, 1);
          if (bidDelta > 0.3) {
            criteria.push({
              criterionId: `str_bid_${term.id}`,
              passed: false,
              score: 60,
              feedback: `"${term.term}": bid adjustment of ₱${decision.newBid} is far from optimal.`,
              details: { refBid, newBid: decision.newBid },
            });
          }
        }
      }
    } else {
      criteria.push({
        criterionId: `str_action_${term.id}`,
        passed: false,
        score: 0,
        feedback: actionFeedback(term.term, decision.action, refAction, term, scenario),
        details: { chosen: decision.action, ref: refAction },
      });
    }
  }

  // Overall correctness
  const correctnessRatio = totalScored > 0 ? correctActionCount / totalScored : 0;
  criteria.push(
    gradedCriterion(
      'action_correctness',
      correctnessRatio,
      `All ${totalScored} terms triaged correctly.`,
      `${correctActionCount} of ${totalScored} terms triaged correctly. Look at the per-term feedback below.`,
      0.75
    )
  );

  // Bolt optimization: Map search terms by ID to replace nested O(N*M) lookups with O(1) lookups
  const termMap = new Map(scenario.searchTerms.map((t) => [t.id, t]));

  // No wasted conversions (did you pause any high-converting terms?) (optimized with O(1) Map lookup)
  const wastedConversions = decisions.filter((d) => {
    const term = termMap.get(d.searchTermId);
    if (!term || term.orders === 0) return false;
    // If they paused a term with orders, that was wrong
    return d.action === 'pause';
  });
  criteria.push(
    binaryCriterion(
      'no_wasted_pauses',
      wastedConversions.length === 0,
      'You did not pause any terms with confirmed conversions.',
      `You paused ${wastedConversions.length} term(s) that had orders. Pause only when there are no orders at all (or ACoS is catastrophically bad).`
    )
  );

  // Negatives applied (did you add negatives for clear junk?) (optimized with O(1) Map lookup)
  const clearJunkNegated = decisions.filter((d) => {
    const term = termMap.get(d.searchTermId);
    if (!term) return false;
    const refAction = scenario.referenceActions[term.id];
    if (refAction !== 'negate-exact' && refAction !== 'negate-phrase') return false;
    // Did the student actually negate?
    if (d.action !== 'negate-exact' && d.action !== 'negate-phrase') return false;
    return term.orders === 0;  // clear junk if no orders
  });
  const clearJunkCount = decisions.filter((d) => {
    const term = termMap.get(d.searchTermId);
    if (!term) return false;
    const refAction = scenario.referenceActions[term.id];
    return refAction === 'negate-exact' || refAction === 'negate-phrase';
  }).length;
  criteria.push(
    gradedCriterion(
      'junk_negated',
      clearJunkCount === 0 ? 1 : clearJunkNegated.length / clearJunkCount,
      'You added negatives for the wasteful search terms.',
      `Some wasteful terms were not negated.`,
      0.7
    )
  );

  // Conversions kept (did you keep terms with sales?) (optimized with O(1) Map lookup)
  const keptConverters = decisions.filter((d) => {
    const term = termMap.get(d.searchTermId);
    if (!term || term.orders === 0) return false;
    return d.action === 'keep' || d.action === 'optimize-bid';
  });
  const shouldKeep = decisions.filter((d) => {
    const term = termMap.get(d.searchTermId);
    return term && term.orders > 0;
  }).length;
  criteria.push(
    gradedCriterion(
      'converters_kept',
      shouldKeep === 0 ? 1 : keptConverters.length / shouldKeep,
      'You kept (or bid-optimized) the terms with confirmed sales.',
      'Some terms with confirmed sales were paused or negated. Pause only when there are zero orders.',
      0.8
    )
  );

  const result = aggregateGrade(criteria, 70);
  return {
    totalScore: result.totalScore,
    criteriaResults: result.criteriaResults,
    passed: result.passed,
    overallFeedback: result.overallFeedback,
  };
}

function actionFeedback(
  term: string,
  chosen: StrAction,
  ref: StrAction,
  termData: { orders: number; acos: number | null; spend: number; sales: number },
  scenario: StrScenario
): string {
  if (chosen === 'pause' && ref !== 'pause') {
    if (termData.orders > 0) {
      return `"${term}" had ${termData.orders} order(s). Pause is too aggressive — try keep or optimize-bid.`;
    }
    return `"${term}" can be salvaged by negating instead of pausing. Pause removes the data; negate keeps it for learning.`;
  }
  if (chosen === 'negate-exact' || chosen === 'negate-phrase') {
    if (ref === 'keep' || ref === 'optimize-bid') {
      return `"${term}" is converting. Negating cuts off a stream of sales.`;
    }
    return `"${term}" can be saved with a different action — see the scenario context.`;
  }
  if (chosen === 'keep' && (ref === 'negate-exact' || ref === 'negate-phrase')) {
    if (termData.orders === 0) {
      return `"${term}" has no orders. Negate as exact to stop the spend.`;
    }
    return `"${term}" is wasting budget. Negate it.`;
  }
  if (chosen === 'optimize-bid' && ref === 'keep') {
    return `"${term}" is already performing well — keep it as is, no bid change needed.`;
  }
  return `"${term}": chosen ${chosen}, reference is ${ref}.`;
}