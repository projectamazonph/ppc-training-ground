import { describe, it, expect } from 'vitest';
import { gradeStrDecisions } from './engine';
import type { StrScenario, StrDecision } from './types';

describe('str-triage engine', () => {
  const mockScenario: StrScenario = {
    id: 's1',
    slug: 'foundations-str-triage',
    title: 'Foundations STR Triage',
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
    },
    searchTerms: [
      {
        id: 'term1',
        term: 'best amazon ppc course',
        matchedKeyword: 'amazon ppc course',
        matchType: 'PHRASE',
        impressions: 1000,
        clicks: 100,
        ctr: 0.1,
        spend: 500,
        cpc: 5,
        orders: 15,
        unitsSold: 15,
        sales: 7500,
        acos: 0.066,
        roas: 15,
      },
      {
        id: 'term2',
        term: 'free cat video guide',
        matchedKeyword: 'advertising guide',
        matchType: 'BROAD',
        impressions: 500,
        clicks: 50,
        ctr: 0.1,
        spend: 300,
        cpc: 6,
        orders: 0,
        unitsSold: 0,
        sales: 0,
        acos: null,
        roas: 0,
      }
    ],
    referenceActions: {
      term1: 'keep',
      term2: 'negate-exact',
    },
    referenceNegatives: {
      term2: 'free cat video guide',
    },
    explanation: 'Test explanation',
  };

  it('correctly grades ideal decisions matching reference actions', () => {
    const decisions: StrDecision[] = [
      { searchTermId: 'term1', action: 'keep' },
      { searchTermId: 'term2', action: 'negate-exact' },
    ];

    const grade = gradeStrDecisions(mockScenario, decisions);
    expect(grade.passed).toBe(true);
    expect(grade.totalScore).toBeGreaterThanOrEqual(70);
  });

  it('correctly grades poor decisions', () => {
    const decisions: StrDecision[] = [
      { searchTermId: 'term1', action: 'pause' },  // pausing a converting term is bad
      { searchTermId: 'term2', action: 'keep' },   // keeping a junk term is bad
    ];

    const grade = gradeStrDecisions(mockScenario, decisions);
    expect(grade.passed).toBe(false);
    expect(grade.totalScore).toBeLessThan(70);
  });
});
