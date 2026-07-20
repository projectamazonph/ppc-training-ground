/**
 * Listing Audit scoring — grades how well the student identified the
 * problems in the listing.
 *
 * Two scoring modes:
 * 1. Findings identification — did they catch the issues?
 * 2. Listing revision — did they write a better version?
 */

import {
  aggregateGrade,
  binaryCriterion,
  gradedCriterion,
  type CriterionResult,
} from '../scoring';
import type {
  ListingAuditScenario,
  ListingDraft,
  ListingAuditGrade,
  ListingAuditFinding,
} from './types';

const PASS = 'Looks right.';
const FAIL = 'Not quite. See the explanation below.';

/**
 * Run the full scoring. Both modes are independent — student can score
 * on findings, on revision, or both.
 */
export function gradeListingAudit(
  scenario: ListingAuditScenario,
  studentFindings: ListingAuditFinding[],
  studentRevision?: Partial<ListingDraft>
): ListingAuditGrade {
  const ref = scenario.referenceFindings;

  // Bolt optimization: Map reference findings by field to replace O(N*M) nested lookups with O(1) lookups
  const refMap = new Map<string, ListingAuditFinding>(
    ref.map((rf) => [rf.field, rf])
  );

  const criteria: CriterionResult[] = [
    // Findings identification
    findingsIdentified(studentFindings, ref),
    findingsAccuracy(studentFindings, refMap),
    severityCalibration(studentFindings, refMap),

    // Listing revision (optional but weighted higher)
    titleQuality(scenario.referenceListing.title, studentRevision?.title),
    bulletCountQuality(scenario.referenceListing.bullets.length, studentRevision?.bullets?.length),
    imageCountQuality(scenario.referenceListing.imageCount, studentRevision?.imageCount),
    aplusContentQuality(scenario.referenceListing.hasAplusContent, studentRevision?.hasAplusContent),
  ];

  return aggregateGrade(criteria, 70);
}

// ---------------------------------------------------------------------------
// Findings criteria
// ---------------------------------------------------------------------------

function findingsIdentified(
  student: ListingAuditFinding[],
  ref: ListingAuditFinding[]
): CriterionResult {
  if (ref.length === 0) {
    return binaryCriterion('findings_coverage', true, PASS, FAIL);
  }
  const refFields = new Set(ref.map((f) => f.field));
  const studentFields = new Set(student.map((f) => f.field));
  let covered = 0;
  for (const f of refFields) {
    if (studentFields.has(f)) covered++;
  }
  return gradedCriterion(
    'findings_coverage',
    covered / refFields.size,
    'You identified the major issues in the listing.',
    'Some issues in the listing were missed — review the reference findings.',
    0.6
  );
}

function findingsAccuracy(
  student: ListingAuditFinding[],
  refMap: Map<string, ListingAuditFinding>
): CriterionResult {
  if (student.length === 0) {
    return binaryCriterion('findings_accuracy', false, PASS, 'No findings submitted.');
  }
  let truePositives = 0;
  for (const sf of student) {
    const match = refMap.get(sf.field);
    if (!match) continue;
    // Exact severity match only — over-calling severity (e.g. warning as
    // critical) is a real skill deficiency in Amazon PPC work, not accuracy.
    if (sf.severity === match.severity) truePositives++;
  }
  const precision = truePositives / student.length;
  return gradedCriterion(
    'findings_accuracy',
    precision,
    'Findings accurately reflect the listing issues.',
    'Some findings did not match the actual issues.',
    0.6
  );
}

function severityCalibration(
  student: ListingAuditFinding[],
  refMap: Map<string, ListingAuditFinding>
): CriterionResult {
  let correct = 0;
  let total = 0;
  for (const sf of student) {
    const match = refMap.get(sf.field);
    if (!match) continue;
    total++;
    if (sf.severity === match.severity) correct++;
  }
  if (total === 0) {
    return binaryCriterion('severity_calibration', true, PASS, FAIL);
  }
  return gradedCriterion(
    'severity_calibration',
    correct / total,
    'Severities match the actual issue severity.',
    'Some severities were off — be careful not to over- or under-call issues.',
    0.5
  );
}

// ---------------------------------------------------------------------------
// Revision criteria
// ---------------------------------------------------------------------------

function titleQuality(
  refTitle: string,
  studentTitle?: string
): CriterionResult {
  if (studentTitle === undefined) {
    return binaryCriterion('title_revised', false, PASS, 'No revised title submitted.');
  }
  const refLen = refTitle.length;
  const studentLen = studentTitle.length;
  if (studentLen < 80) {
    return binaryCriterion('title_revised', false, PASS, 'Title is too short — Amazon titles should be 150-200 characters.');
  }
  if (studentLen > 250) {
    return binaryCriterion('title_revised', false, PASS, 'Title is too long — Amazon truncates at ~200 characters.');
  }
  const ratio = Math.min(studentLen / Math.max(refLen, 1), 1);
  return gradedCriterion(
    'title_revised',
    ratio,
    'Revised title length is in a good range.',
    'Title length is off — aim for 150-200 characters.',
    0.7
  );
}

function bulletCountQuality(
  refCount: number,
  studentCount?: number
): CriterionResult {
  if (studentCount === undefined) {
    return binaryCriterion('bullets_revised', false, PASS, 'No revised bullets submitted.');
  }
  if (studentCount < 3) {
    return binaryCriterion('bullets_revised', false, PASS, 'Fewer than 3 bullets — Amazon allows up to 5.');
  }
  return binaryCriterion(
    'bullets_revised',
    studentCount >= 3 && studentCount <= 5,
    'Bullet count is in the allowed range (3-5).',
    'Bullet count must be between 3 and 5.'
  );
}

function imageCountQuality(
  refCount: number,
  studentCount?: number
): CriterionResult {
  if (studentCount === undefined) {
    return binaryCriterion('images_revised', false, PASS, 'No revised image count submitted.');
  }
  if (studentCount < 7) {
    return binaryCriterion('images_revised', false, PASS, 'Listings with 7+ images convert better. The reference uses more.');
  }
  return gradedCriterion(
    'images_revised',
    Math.min(studentCount / Math.max(refCount, 1), 1),
    'Image count meets or exceeds the reference.',
    `Reference uses ${refCount} images.`,
    0.7
  );
}

function aplusContentQuality(
  refHasAplus: boolean,
  studentHasAplus?: boolean
): CriterionResult {
  if (studentHasAplus === undefined) {
    return binaryCriterion('aplus_revised', false, PASS, 'No A+ content decision submitted.');
  }
  if (refHasAplus && !studentHasAplus) {
    return binaryCriterion(
      'aplus_revised',
      false,
      PASS,
      'The reference listing uses A+ content — your revision should too.'
    );
  }
  return binaryCriterion(
    'aplus_revised',
    true,
    'A+ content decision matches.',
    FAIL
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate automatic findings for a listing against an optimized reference.
 * Used by the engine for display when student starts a scenario.
 */
export function generateAutoFindings(
  current: ListingDraft,
  reference: ListingDraft
): ListingAuditFinding[] {
  const findings: ListingAuditFinding[] = [];

  // Title
  if (current.title.length < 100) {
    findings.push({
      field: 'title',
      severity: 'critical',
      message: `Title is only ${current.title.length} characters — Amazon best practice is 150-200.`,
    });
  } else if (current.title.length < 150) {
    findings.push({
      field: 'title',
      severity: 'warning',
      message: `Title is ${current.title.length} characters — could be longer to include more keywords.`,
    });
  } else {
    findings.push({ field: 'title', severity: 'good', message: 'Title length is in the optimal range.' });
  }

  // Bullets
  if (current.bullets.length < 3) {
    findings.push({
      field: 'bullets',
      severity: 'critical',
      message: `Only ${current.bullets.length} bullet(s) — Amazon allows up to 5.`,
    });
  } else if (current.bullets.length < 5) {
    findings.push({
      field: 'bullets',
      severity: 'warning',
      message: `${current.bullets.length} bullets — could use 5 for maximum keyword coverage.`,
    });
  }

  // Images
  if (current.imageCount < 5) {
    findings.push({
      field: 'images',
      severity: 'critical',
      message: `Only ${current.imageCount} images — listings with 7+ images convert significantly better.`,
    });
  } else if (current.imageCount < 7) {
    findings.push({
      field: 'images',
      severity: 'warning',
      message: `${current.imageCount} images — could be 7 or more.`,
    });
  }

  // A+ Content
  if (!current.hasAplusContent && reference.hasAplusContent) {
    findings.push({
      field: 'aplus',
      severity: 'warning',
      message: 'No A+ content — A+ content can lift conversion 5-10%.',
    });
  }

  // Reviews
  if (current.reviewCount < 50) {
    findings.push({
      field: 'reviews',
      severity: current.reviewCount < 10 ? 'critical' : 'warning',
      message: `Only ${current.reviewCount} reviews — early-stage review velocity matters.`,
    });
  }
  if (current.averageRating < 4.0) {
    findings.push({
      field: 'reviews',
      severity: 'critical',
      message: `Average rating is ${current.averageRating.toFixed(1)} — anything below 4.0 kills conversion.`,
    });
  }

  // Description
  if (current.description.length < 200) {
    findings.push({
      field: 'description',
      severity: 'warning',
      message: 'Description is short — longer descriptions with keywords help SEO.',
    });
  }

  return findings;
}