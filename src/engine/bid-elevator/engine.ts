/**
 * Bid Elevator scoring — deterministic checks against the reference bids.
 *
 * Scoring rewards moving bids toward the reference while penalizing
 * extreme over- or under-bidding, and not exceeding budget.
 */

import {
  aggregateGrade,
  binaryCriterion,
  gradedCriterion,
  type CriterionResult,
} from '../scoring';
import type {
  BidScenario,
  BidElevatorGrade,
  KeywordDecision,
} from './types';

/**
 * Score a round of decisions against the scenario reference.
 */
export function gradeBidDecisions(
  scenario: BidScenario,
  decisions: KeywordDecision[]
): BidElevatorGrade {
  // Compute current performance for each keyword
  const keywordPerf = new Map(
    scenario.keywords.map((k) => {
      const ctr = k.impressions > 0 ? k.clicks / k.impressions : 0;
      const cvr = k.clicks > 0 ? k.orders / k.clicks : 0;
      const acos = k.sales > 0 ? k.spend / k.sales : null;
      const roas = k.spend > 0 ? k.sales / k.spend : 0;
      return [k.id, { ctr, cvr, acos, roas }];
    })
  );

  // Bolt optimization: Map keywords by ID to replace O(N*M) nested lookups with O(1) lookups
  const keywordMap = new Map(scenario.keywords.map((k) => [k.id, k]));

  const criteria: CriterionResult[] = [];

  // For each keyword, score the bid decision
  let totalRatio = 0;
  let keywordsScored = 0;

  for (const decision of decisions) {
    const keyword = keywordMap.get(decision.keywordId);
    const refBid = scenario.referenceBids[decision.keywordId];
    if (!keyword || refBid === undefined) continue;

    const ratio = bidRatio(decision.newBid, refBid, keyword.currentBid);
    totalRatio += ratio;
    keywordsScored++;

    // Per-keyword criterion (only check major errors for the overall score)
    if (ratio < 0.3) {
      criteria.push({
        criterionId: `bid_${keyword.id}`,
        passed: false,
        score: Math.round(ratio * 100),
        feedback: `${keyword.text}: bid of ₱${decision.newBid} is far from the optimal range.`,
        details: { currentBid: keyword.currentBid, refBid, newBid: decision.newBid },
      });
    }
  }

  // Aggregate bid accuracy
  const avgBidRatio = keywordsScored > 0 ? totalRatio / keywordsScored : 0;
  criteria.push(
    gradedCriterion(
      'bid_accuracy_overall',
      avgBidRatio,
      'Your bids are in the optimal range across the board.',
      'Several keywords have bids that are too high or too low — review the per-keyword feedback below.',
      0.7
    )
  );

  // Budget check (optimized with O(1) Map lookup)
  const totalDecidedSpend = decisions.reduce((sum, d) => {
    const keyword = keywordMap.get(d.keywordId);
    if (!keyword) return sum;
    const cvr = keyword.clicks > 0 ? keyword.orders / keyword.clicks : 0;
    const estClicks = Math.round(keyword.clicks * (d.newBid / Math.max(keyword.currentBid, 1)) * 0.8);
    const estSpend = estClicks * d.newBid;
    return sum + estSpend;
  }, 0);
  const budgetRatio = scenario.constraints.dailyBudget > 0
    ? 1 - Math.max(0, (totalDecidedSpend - scenario.constraints.dailyBudget) / scenario.constraints.dailyBudget)
    : 1;
  criteria.push(
    gradedCriterion(
      'budget_compliance',
      budgetRatio,
      'Estimated daily spend is within budget.',
      'Estimated daily spend exceeds the daily budget. Either lower some bids or pause the most wasteful keywords.',
      0.85
    )
  );

  // ACoS awareness check (optimized with O(1) Map lookup)
  const hasAcOsAwareness = decisions.some((d) => {
    const keyword = keywordMap.get(d.keywordId);
    if (!keyword || keyword.sales === 0) return false;
    const acos = keyword.spend / keyword.sales;
    return acos > scenario.product.targetAcos && d.newBid < keyword.currentBid; // lowered a high-ACoS keyword
  });
  criteria.push(
    binaryCriterion(
      'acos_awareness',
      hasAcOsAwareness || decisions.every((d) => {
        const k = keywordMap.get(d.keywordId);
        return !k || k.sales === 0 || (k.spend / k.sales) <= scenario.product.targetAcos;
      }),
      'You lowered bids on at least one keyword with ACoS above target (or kept good keywords).',
      'Some keywords have ACoS above target but you did not lower their bids. Bring spend back in line.'
    )
  );

  // Conversion awareness — raise bids on converters (optimized with O(1) Map lookup)
  const hasConversionRaise = decisions.some((d) => {
    const keyword = keywordMap.get(d.keywordId);
    if (!keyword || keyword.clicks < 5) return false;
    const cvr = keyword.orders / keyword.clicks;
    return cvr >= 0.10 && d.newBid > keyword.currentBid;
  });
  criteria.push(
    binaryCriterion(
      'conversion_awareness',
      hasConversionRaise || decisions.every((d) => {
        const k = keywordMap.get(d.keywordId);
        if (!k || k.clicks < 5) return true;
        const cvr = k.orders / k.clicks;
        return cvr < 0.10 || d.newBid <= k.currentBid;
      }),
      'You raised bids on at least one high-converting keyword (or kept steady on underperformers).',
      'Some keywords convert at 10%+ but you did not raise their bids — you are leaving sales on the table.'
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

/**
 * Compute ratio of "how close" the new bid is to the reference.
 * Penalty grows with distance; capped.
 */
function bidRatio(newBid: number, refBid: number, currentBid: number): number {
  if (newBid <= 0 || refBid <= 0) return 0;
  // Distance from reference, normalized by reference
  const distFromRef = Math.abs(newBid - refBid) / refBid;
  const distFromCurrent = Math.abs(newBid - currentBid) / currentBid;

  // Both should be reasonable: not too far from ref, not too far from current
  const refScore = Math.max(0, 1 - distFromRef);
  const moveScore = Math.max(0, 1 - distFromCurrent * 0.5); // moving too far at once is bad

  return refScore * 0.7 + moveScore * 0.3;
}

/**
 * Performance helper for a keyword.
 */
export type KeywordPerformance = {
  ctr: number;
  cvr: number;
  acos: number | null;
  roas: number;
};

export function computePerformance(keyword: {
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  sales: number;
}): KeywordPerformance {
  return {
    ctr: keyword.impressions > 0 ? keyword.clicks / keyword.impressions : 0,
    cvr: keyword.clicks > 0 ? keyword.orders / keyword.clicks : 0,
    acos: keyword.sales > 0 ? keyword.spend / keyword.sales : null,
    roas: keyword.spend > 0 ? keyword.sales / keyword.spend : 0,
  };
}