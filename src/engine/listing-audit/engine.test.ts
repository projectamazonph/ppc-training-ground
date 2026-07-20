import { describe, it, expect } from 'vitest';
import { gradeListingAudit } from './engine';
import type { ListingAuditScenario, ListingAuditFinding } from './types';

describe('listing-audit engine', () => {
  const referenceListing = {
    title: 'A'.repeat(180),
    bullets: ['b1', 'b2', 'b3', 'b4', 'b5'],
    description: 'D'.repeat(300),
    imageCount: 8,
    hasAplusContent: true,
    pricePhp: 999,
    reviewCount: 200,
    averageRating: 4.5,
  };

  const mockScenario: ListingAuditScenario = {
    id: 's1',
    slug: 'kitchen-cutting-board',
    category: 'kitchen',
    product: {
      asin: 'B012345678',
      name: 'Cutting Board',
      category: 'Kitchen',
      aov: 500,
      targetAcos: 0.3,
    },
    currentListing: { ...referenceListing, imageCount: 3, hasAplusContent: false },
    referenceListing,
    referenceFindings: [
      { field: 'title', severity: 'warning', message: 'Title could be longer.' },
      { field: 'images', severity: 'critical', message: 'Too few images.' },
    ],
    explanation: 'Test scenario.',
  };

  function accuracyResult(findings: ListingAuditFinding[]) {
    const grade = gradeListingAudit(mockScenario, findings);
    const result = grade.criteriaResults.find((r) => r.criterionId === 'findings_accuracy');
    if (!result) throw new Error('findings_accuracy criterion missing');
    return result;
  }

  it('gives full accuracy credit for exact severity matches', () => {
    const result = accuracyResult([
      { field: 'title', severity: 'warning', message: '' },
      { field: 'images', severity: 'critical', message: '' },
    ]);
    expect(result.score).toBe(100);
  });

  it('does not give accuracy credit for over-calling severity (regression, issue #51)', () => {
    // Student marks a "warning" issue as "critical" — over-calling, not accurate.
    const result = accuracyResult([
      { field: 'title', severity: 'critical', message: '' },
      { field: 'images', severity: 'critical', message: '' },
    ]);
    // Only the "images" finding is an exact match; "title" over-calls severity.
    expect(result.score).toBe(50);
  });

  it('does not give accuracy credit for under-calling severity', () => {
    const result = accuracyResult([
      { field: 'title', severity: 'warning', message: '' },
      { field: 'images', severity: 'warning', message: '' },
    ]);
    expect(result.score).toBe(50);
  });
});
