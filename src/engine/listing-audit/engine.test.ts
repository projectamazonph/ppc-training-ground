import { describe, it, expect } from 'vitest';
import { gradeListingAudit, generateAutoFindings } from './engine';
import type { ListingAuditScenario, ListingAuditFinding, ListingDraft } from './types';

describe('listing-audit engine', () => {
  const mockScenario: ListingAuditScenario = {
    id: 'la-test-001',
    slug: 'test-cutting-board',
    category: 'kitchen',
    product: {
      asin: 'B09KCB001',
      name: 'Bamboo Cutting Board with Juice Groove',
      category: 'Kitchen',
      aov: 1200,
      targetAcos: 0.30,
    },
    currentListing: {
      title: 'Bamboo Cutting Board',
      bullets: ['Bamboo material', 'Durable', 'For kitchen use'],
      description: 'A cutting board made from bamboo.',
      imageCount: 3,
      hasAplusContent: false,
      pricePhp: 1200,
      reviewCount: 18,
      averageRating: 4.3,
    },
    referenceListing: {
      title: 'Bamboo Cutting Board with Deep Juice Groove — Eco-Friendly Kitchen Chopping Board for Vegetables, Meat, Cheese | Large 16x12 inch with Non-Slip Feet | Durable, Dishwasher Safe',
      bullets: [
        'DEEP JUICE GROOVE — Catches liquids from meat, fruit, and vegetables. No more countertop spills.',
        'ECO-FRIENDLY BAMBOO — Sustainably sourced, naturally antibacterial. Lasts longer than plastic.',
        'LARGE 16x12 INCH — Fits a whole meal prep. Reversible design doubles your workspace.',
        'NON-SLIP FEET — Stays put on the counter. No more chasing the board while chopping.',
        'DISHWASHER SAFE — Easy cleanup. Oil monthly with food-grade mineral oil for best results.',
      ],
      description: 'A longer description with more details.',
      imageCount: 9,
      hasAplusContent: true,
      pricePhp: 1200,
      reviewCount: 200,
      averageRating: 4.6,
    },
    referenceFindings: [
      { field: 'title', severity: 'critical', message: 'Title is too short.' },
      { field: 'bullets', severity: 'critical', message: 'Only 3 bullets.' },
      { field: 'images', severity: 'critical', message: 'Only 3 images.' },
      { field: 'aplus', severity: 'warning', message: 'No A+ content.' },
      { field: 'reviews', severity: 'warning', message: 'Only 18 reviews.' },
    ],
    explanation: 'Test explanation',
  };

  it('correctly grades perfectly matching student findings and revision', () => {
    const studentFindings: ListingAuditFinding[] = [
      { field: 'title', severity: 'critical', message: 'Title is too short.' },
      { field: 'bullets', severity: 'critical', message: 'Only 3 bullets.' },
      { field: 'images', severity: 'critical', message: 'Only 3 images.' },
      { field: 'aplus', severity: 'warning', message: 'No A+ content.' },
      { field: 'reviews', severity: 'warning', message: 'Only 18 reviews.' },
    ];

    const studentRevision: ListingDraft = {
      title: 'Bamboo Cutting Board with Deep Juice Groove — Eco-Friendly Kitchen Chopping Board for Vegetables, Meat, Cheese | Large 16x12 inch with Non-Slip Feet | Durable, Dishwasher Safe',
      bullets: [
        'DEEP JUICE GROOVE — Catches liquids from meat, fruit, and vegetables. No more countertop spills.',
        'ECO-FRIENDLY BAMBOO — Sustainably sourced, naturally antibacterial. Lasts longer than plastic.',
        'LARGE 16x12 INCH — Fits a whole meal prep. Reversible design doubles your workspace.',
        'NON-SLIP FEET — Stays put on the counter. No more chasing the board while chopping.',
        'DISHWASHER SAFE — Easy cleanup. Oil monthly with food-grade mineral oil for best results.',
      ],
      description: 'A longer description with more details.',
      imageCount: 9,
      hasAplusContent: true,
      pricePhp: 1200,
      reviewCount: 200,
      averageRating: 4.6,
    };

    const grade = gradeListingAudit(mockScenario, studentFindings, studentRevision);
    expect(grade.passed).toBe(true);
    expect(grade.totalScore).toBeGreaterThanOrEqual(90);
  });

  it('correctly grades poor or incomplete submissions', () => {
    const studentFindings: ListingAuditFinding[] = [];
    const grade = gradeListingAudit(mockScenario, studentFindings, {});
    expect(grade.passed).toBe(false);
    expect(grade.totalScore).toBeLessThan(70);
  });

  it('generates auto findings correctly', () => {
    const auto = generateAutoFindings(mockScenario.currentListing, mockScenario.referenceListing);
    expect(auto.length).toBeGreaterThan(0);
    expect(auto.some((f) => f.field === 'title')).toBe(true);
    expect(auto.some((f) => f.field === 'bullets')).toBe(true);
  });
});
