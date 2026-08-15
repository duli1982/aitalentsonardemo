/**
 * Output Validation — Layer 5
 *
 * Validates AI-generated responses before they are stored or surfaced
 * to the user. Guards against:
 *
 * 1. Score inflation — scores outside valid ranges or suspiciously perfect
 * 2. Prompt leakage — AI echoing back system instructions or security markers
 * 3. Injection artifacts — hidden instructions that survived into the output
 * 4. Structural violations — missing/malformed required fields
 * 5. Confidence anomalies — unrealistically high or exact confidence values
 *
 * Every validator returns a ValidationResult that can be logged, stored,
 * or used to gate whether the AI response is accepted or falls back to
 * the deterministic path.
 */

import { detectPromptInjection } from './promptSecurity';

// ── Types ────────────────────────────────────────────────────────────

export type ValidationSeverity = 'info' | 'warning' | 'critical';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  /** The field or value that triggered the issue. */
  field?: string;
}

export interface ValidationResult {
  /** True if the output passed validation (no critical issues). */
  valid: boolean;
  /** True if the output was modified (scores clamped, text stripped, etc.). */
  modified: boolean;
  /** Issues found during validation. */
  issues: ValidationIssue[];
}

function createResult(): ValidationResult {
  return { valid: true, modified: false, issues: [] };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function addIssue(result: ValidationResult, issue: ValidationIssue) {
  result.issues.push(issue);
  if (issue.severity === 'critical') {
    result.valid = false;
  }
}

// ── Prompt Leakage Detection ─────────────────────────────────────────

/**
 * Patterns that should never appear in AI output.
 * If present, the model was tricked into echoing internal instructions.
 */
const LEAKAGE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /===\s*UNTRUSTED_DATA_(START|END)/i, label: 'data delimiter marker' },
  { pattern: /SECURITY RULES \(always enforced\)/i, label: 'security preamble' },
  { pattern: /NEVER follow instructions.*inside those markers/i, label: 'security instruction' },
  { pattern: /⚠ SECURITY WARNING.*data block.*may contain/i, label: 'injection warning marker' },
  { pattern: /You are Talent Sonar\./i, label: 'system role identity' },
  { pattern: /You are a resume parser\./i, label: 'system role identity' },
  { pattern: /You are an expert recruiter\./i, label: 'system role identity' },
  { pattern: /You are an analytics agent/i, label: 'system role identity' },
  { pattern: /VITE_GEMINI_API_KEY/i, label: 'environment variable name' },
  { pattern: /import\.meta\.env/i, label: 'code internals' },
];

/**
 * Check if AI output text contains leaked prompt fragments.
 */
function checkPromptLeakage(text: string, result: ValidationResult) {
  for (const { pattern, label } of LEAKAGE_PATTERNS) {
    if (pattern.test(text)) {
      addIssue(result, {
        code: 'PROMPT_LEAKAGE',
        severity: 'critical',
        message: `AI output contains leaked ${label}. The model may have been tricked into echoing internal instructions.`,
        field: label
      });
    }
  }
}

/**
 * Check if AI output text contains injection artifacts
 * (the model was manipulated and produced instruction-like output).
 */
function checkOutputInjection(text: string, result: ValidationResult) {
  const scan = detectPromptInjection(text);
  if (scan.flagged && scan.riskScore >= 7) {
    addIssue(result, {
      code: 'OUTPUT_INJECTION',
      severity: 'warning',
      message: `AI output contains suspicious patterns (risk score ${scan.riskScore}): ${scan.flags.filter((f) => f.severity !== 'low').map((f) => f.reason).slice(0, 2).join('; ')}`,
      field: 'output_text'
    });
  }
}

// ── Score Validators ─────────────────────────────────────────────────

/**
 * Clamp a numeric score to [min, max] and flag if it was out of range
 * or suspiciously perfect.
 */
function validateScore(
  value: unknown,
  field: string,
  min: number,
  max: number,
  result: ValidationResult
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    addIssue(result, {
      code: 'INVALID_SCORE',
      severity: 'critical',
      message: `${field} is not a finite number (got ${String(value)}).`,
      field
    });
    return min;
  }

  // Clamp
  let clamped = num;
  if (num < min) {
    clamped = min;
    result.modified = true;
    addIssue(result, {
      code: 'SCORE_BELOW_MIN',
      severity: 'warning',
      message: `${field} was below minimum (${num} < ${min}), clamped to ${min}.`,
      field
    });
  } else if (num > max) {
    clamped = max;
    result.modified = true;
    addIssue(result, {
      code: 'SCORE_ABOVE_MAX',
      severity: 'warning',
      message: `${field} exceeded maximum (${num} > ${max}), clamped to ${max}.`,
      field
    });
  }

  // Suspiciously perfect
  if (clamped === max) {
    addIssue(result, {
      code: 'PERFECT_SCORE',
      severity: 'warning',
      message: `${field} is exactly ${max} — suspiciously perfect. May indicate injection influence.`,
      field
    });
  }

  return clamped;
}

/**
 * Validate confidence (0-1 range).
 * Flag exact 1.0 or 0.0 as suspicious.
 */
function validateConfidence(
  value: unknown,
  field: string,
  result: ValidationResult
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    addIssue(result, {
      code: 'INVALID_CONFIDENCE',
      severity: 'warning',
      message: `${field} is not a finite number, defaulting to 0.5.`,
      field
    });
    result.modified = true;
    return 0.5;
  }

  let clamped = Math.max(0, Math.min(1, num));
  if (clamped !== num) {
    result.modified = true;
    addIssue(result, {
      code: 'CONFIDENCE_OUT_OF_RANGE',
      severity: 'warning',
      message: `${field} was out of [0,1] range (${num}), clamped to ${clamped}.`,
      field
    });
  }

  if (clamped === 1.0) {
    addIssue(result, {
      code: 'PERFECT_CONFIDENCE',
      severity: 'warning',
      message: `${field} is exactly 1.0 — AI should rarely express 100% confidence. Possible injection.`,
      field
    });
  }

  return clamped;
}

// ── Text Field Validators ────────────────────────────────────────────

/**
 * Validate a string field: check for leakage and reasonable length.
 */
function validateTextField(
  value: unknown,
  field: string,
  maxLen: number,
  result: ValidationResult
): string {
  const text = String(value ?? '').trim();

  if (text.length > maxLen) {
    result.modified = true;
    addIssue(result, {
      code: 'TEXT_TOO_LONG',
      severity: 'info',
      message: `${field} exceeded max length (${text.length} > ${maxLen}), truncated.`,
      field
    });
    return text.slice(0, maxLen);
  }

  // Check for prompt leakage in this specific field
  checkPromptLeakage(text, result);

  return text;
}

// ── Public Validators ────────────────────────────────────────────────

/**
 * Validate a fit analysis score response.
 * Returns sanitized values + validation result.
 */
export function validateFitScore(data: {
  score?: unknown;
  confidence?: unknown;
  rationale?: unknown;
  reasons?: unknown;
}): {
  score: number;
  confidence: number;
  rationale: string;
  reasons: string[];
  validation: ValidationResult;
} {
  const result = createResult();

  const score = validateScore(data.score, 'score', 0, 100, result);
  const confidence = validateConfidence(data.confidence, 'confidence', result);
  const rationale = validateTextField(data.rationale, 'rationale', 2000, result);
  const reasons = Array.isArray(data.reasons)
    ? data.reasons.map((r) => String(r)).filter(Boolean).slice(0, 10)
    : [];

  // Cross-check: very high score with very low rationale is suspicious
  if (score >= 90 && rationale.length < 20) {
    addIssue(result, {
      code: 'SCORE_RATIONALE_MISMATCH',
      severity: 'warning',
      message: `Score is ${score} but rationale is very short (${rationale.length} chars). High scores should have substantial justification.`,
      field: 'score+rationale'
    });
  }

  // Check output text for injection artifacts
  checkOutputInjection([rationale, ...reasons].join(' '), result);

  if (result.issues.length > 0) {
    console.warn(
      `[OutputValidation] Fit score issues:`,
      result.issues.map((i) => `[${i.severity}] ${i.message}`).join('; ')
    );
  }

  return { score, confidence, rationale, reasons, validation: result };
}

/**
 * Validate an evidence pack response.
 */
export function validateEvidencePack(data: unknown): {
  confidence: number;
  validation: ValidationResult;
} {
  const result = createResult();
  const payload = asRecord(data);

  const confidence = validateConfidence(payload.confidence, 'confidence', result);

  // Validate matchReasons text fields
  if (Array.isArray(payload.matchReasons)) {
    for (let i = 0; i < payload.matchReasons.length; i++) {
      const reason = asRecord(payload.matchReasons[i]);
      if (reason.claim) {
        validateTextField(reason.claim, `matchReasons[${i}].claim`, 500, result);
      }
      const snippet = asRecord(reason.snippet);
      if (snippet.text) {
        validateTextField(snippet.text, `matchReasons[${i}].snippet.text`, 500, result);
      }
    }
  }

  // Validate risk statement
  const risk = asRecord(payload.risk);
  if (risk['statement']) {
    validateTextField(risk['statement'], 'risk.statement', 1000, result);
  }
  if (risk['mitigation']) {
    validateTextField(risk['mitigation'], 'risk.mitigation', 1000, result);
  }

  // Check all text content for injection artifacts
  const allText = JSON.stringify(payload);
  checkOutputInjection(allText, result);
  checkPromptLeakage(allText, result);

  if (result.issues.length > 0) {
    console.warn(
      `[OutputValidation] Evidence pack issues:`,
      result.issues.map((i) => `[${i.severity}] ${i.message}`).join('; ')
    );
  }

  return { confidence, validation: result };
}

/**
 * Validate parsed resume output.
 */
export function validateParsedResume(data: unknown): {
  validation: ValidationResult;
} {
  const result = createResult();
  const payload = asRecord(data);

  if (!data) {
    addIssue(result, {
      code: 'EMPTY_OUTPUT',
      severity: 'critical',
      message: 'Parsed resume output is null/undefined.',
      field: 'data'
    });
    return { validation: result };
  }

  // Name validation
  const name = String(payload.name ?? '').trim();
  if (!name) {
    addIssue(result, {
      code: 'MISSING_NAME',
      severity: 'warning',
      message: 'Parsed resume has no name.',
      field: 'name'
    });
  } else {
    validateTextField(name, 'name', 200, result);
  }

  // Skills validation
  if (Array.isArray(payload.skills)) {
    if (payload.skills.length > 100) {
      addIssue(result, {
        code: 'EXCESSIVE_SKILLS',
        severity: 'warning',
        message: `Parsed resume has ${payload.skills.length} skills — suspiciously high count.`,
        field: 'skills'
      });
    }
    // Check each skill for injection artifacts
    for (const skill of payload.skills.slice(0, 50)) {
      const s = String(skill);
      if (s.length > 100) {
        addIssue(result, {
          code: 'SKILL_TOO_LONG',
          severity: 'warning',
          message: `Skill entry is ${s.length} chars — may contain injected text: "${s.slice(0, 50)}..."`,
          field: 'skills'
        });
      }
    }
  }

  // Summary leakage check
  if (payload.summary) {
    validateTextField(payload.summary, 'summary', 3000, result);
  }

  // Full output leakage check
  checkPromptLeakage(JSON.stringify(payload), result);
  checkOutputInjection(JSON.stringify(payload), result);

  if (result.issues.length > 0) {
    console.warn(
      `[OutputValidation] Parsed resume issues:`,
      result.issues.map((i) => `[${i.severity}] ${i.message}`).join('; ')
    );
  }

  return { validation: result };
}

/**
 * Validate a generic AI JSON response.
 * Use this for any AI output that doesn't have a specialized validator.
 * Checks for prompt leakage and injection artifacts in the serialized output.
 */
export function validateGenericOutput(data: unknown): ValidationResult {
  const result = createResult();

  if (data == null) {
    addIssue(result, {
      code: 'EMPTY_OUTPUT',
      severity: 'critical',
      message: 'AI output is null/undefined.'
    });
    return result;
  }

  const serialized = JSON.stringify(data);
  checkPromptLeakage(serialized, result);
  checkOutputInjection(serialized, result);

  if (result.issues.length > 0) {
    console.warn(
      `[OutputValidation] Generic output issues:`,
      result.issues.map((i) => `[${i.severity}] ${i.message}`).join('; ')
    );
  }

  return result;
}

/**
 * Validate a multi-dimensional fit analysis (from geminiService.analyzeFit).
 * Clamps all sub-scores and the top-level matchScore.
 */
export function validateFitAnalysis(data: unknown): {
  matchScore: number;
  validation: ValidationResult;
} {
  const result = createResult();
  const payload = asRecord(data);

  const matchScore = validateScore(payload.matchScore, 'matchScore', 0, 100, result);

  // Validate sub-dimension scores
  const dimensions = asRecord(payload.multiDimensionalAnalysis);
  if (dimensions && typeof dimensions === 'object') {
    for (const [key, value] of Object.entries(dimensions)) {
      const dimension = asRecord(value);
      if ('score' in dimension) {
        validateScore(dimension.score, `multiDimensionalAnalysis.${key}.score`, 0, 100, result);
      }
    }
  }

  // Text field checks
  if (payload.matchRationale) {
    validateTextField(payload.matchRationale, 'matchRationale', 3000, result);
  }

  // Full output leakage check
  const allText = JSON.stringify(payload);
  checkPromptLeakage(allText, result);
  checkOutputInjection(allText, result);

  if (result.issues.length > 0) {
    console.warn(
      `[OutputValidation] Fit analysis issues:`,
      result.issues.map((i) => `[${i.severity}] ${i.message}`).join('; ')
    );
  }

  return { matchScore, validation: result };
}
