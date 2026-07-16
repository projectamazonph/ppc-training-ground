import { describe, it, expect } from 'vitest';
import { gradeBidDecisions, computePerformance } from './engine';
import type { BidScenario, KeywordDecision } from './types';

describe('bid-elevator engine', () => {
  const mockScenario: BidScenario = {
    id: 's1',
    slug: 'foundations-bid-triage',
    title: 'Foundations Triage',
    context: 'Test context',
    product: {
      asin: 'B012345678',
      name: 'PPC Guide',
      aov: 500,
      targetAcos: 0.3,
    },
    constraints: {
      dailyBudget: 1000,
      currentDailySpend: 800,
      roundsRemaining: 3,
    },
    keywords: [
      {
        id: 'kw1',
        text: 'amazon ppc course',
        matchType: 'EXACT',
        currentBid: 50,
        impressions: 1000,
        clicks: 100,
        orders: 15,
        spend: 500,
        sales: 7500, // ACoS = 500/7500 = 6.6% (good, keep/raise)
      },
      {
        id: 'kw2',
        text: 'free advertising guide',
        matchType: 'BROAD',
        currentBid: 30,
        impressions: 500,
        clicks: 50,
        orders: 1,
        spend: 300,
        sales: 200, // ACoS = 300/200 = 150% (terrible, lower)
      }
    ],
    referenceBids: {
      kw1: 60, // raise bid since it converts well and ACoS is well below target
      kw2: 15, // lower bid
    },
    explanation: 'Test explanation',
  };

  it('correctly grades ideal decisions matching reference bids', () => {
    const decisions: KeywordDecision[] = [
      { keywordId: 'kw1', newBid: 60 },
      { keywordId: 'kw2', newBid: 15 },
    ];

    const grade = gradeBidDecisions(mockScenario, decisions);
    expect(grade.passed).toBe(true);
    expect(grade.totalScore).toBeGreaterThanOrEqual(70);
  });

  it('correctly grades poor decisions', () => {
    const decisions: KeywordDecision[] = [
      { keywordId: 'kw1', newBid: 10 },  // way too low
      { keywordId: 'kw2', newBid: 100 }, // way too high
    ];

    const grade = gradeBidDecisions(mockScenario, decisions);
    expect(grade.passed).toBe(false);
    expect(grade.totalScore).toBeLessThan(70);
  });

  it('computes performance correctly', () => {
    const perf = computePerformance({
      impressions: 1000,
      clicks: 100,
      orders: 10,
      spend: 500,
      sales: 2000,
    });
    expect(perf.ctr).toBe(0.1);
    expect(perf.cvr).toBe(0.1);
    expect(perf.acos).toBe(0.25);
    expect(perf.roas).toBe(4);
  });
});
