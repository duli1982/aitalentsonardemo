import { Type } from '@google/genai';
import type { CandidateSnapshot, JobSnapshot, RoleContextPack } from '../types';
import { aiService } from './AIService';
import { computeMatchScorecard } from './MatchScorecardService';
import { sanitizeForPrompt, sanitizeArray, sanitizeShort, buildSecurePrompt } from '../utils/promptSecurity';
import { validateGenericOutput } from '../utils/outputValidation';

export type TruthCheckRubricBand = 'strong' | 'adequate' | 'concern';

export interface TruthCheckRubric {
  strong: string[];
  adequate: string[];
  concern: string[];
}

export interface TruthCheckQuestion {
  id: string;
  question: string;
  rubric: TruthCheckRubric;
}

export interface TruthCheckPack {
  version: 1;
  jobId: string;
  candidateId: string;
  questions: TruthCheckQuestion[]; // exactly 5
  createdAt: string;
  method: 'deterministic' | 'ai';
}

function safeText(input: unknown, maxLen: number): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function ensureDescribeLastTime(question: string): string {
  const q = String(question || '').trim();
  if (!q) return 'Describe the last time you did X. What happened?';
  if (q.toLowerCase().startsWith('describe the last time')) return q;
  return `Describe the last time ${q.replace(/^[a-z]+/i, (m) => m.toLowerCase())}`;
}

const GENERIC_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(extensive experience|highly experienced|very familiar)\b/i, reason: 'Generic claim ("extensive experience")' },
  { pattern: /\b(i have worked on multiple projects|various projects)\b/i, reason: 'Vague scope ("multiple projects")' },
  { pattern: /\b(best practices|industry standards)\b/i, reason: 'Buzzword without specifics' },
  { pattern: /\b(team player|hard working|fast learner)\b/i, reason: 'Soft-skill filler without example' },
  { pattern: /\b(synergy|leveraged|utilized)\b/i, reason: 'Corporate filler language' }
];

export function detectGenericAnswer(answer: string): { isGeneric: boolean; reasons: string[] } {
  const text = String(answer || '').trim();
  if (!text) return { isGeneric: true, reasons: ['Empty answer'] };

  const reasons: string[] = [];
  GENERIC_PATTERNS.forEach((p) => {
    if (p.pattern.test(text)) reasons.push(p.reason);
  });

  // Very short answers tend to be non-evidentiary.
  if (text.split(/\s+/).length < 18) reasons.push('Too short to contain concrete evidence');

  // No numbers often indicates lack of measurable detail (best-effort heuristic).
  if (!/\d/.test(text)) reasons.push('No measurable details (numbers/dates) found');

  return { isGeneric: reasons.length >= 2, reasons };
}

function defaultRubric(): TruthCheckRubric {
  return {
    strong: [
      'Specific project/context (who/what/when).',
      'Concrete actions taken (not just responsibilities).',
      'Clear outcome with measurable impact (metrics/time/cost/quality).',
      'Mentions tradeoffs and constraints.'
    ],
    adequate: [
      'Reasonable description of approach and tools.',
      'Some specificity but limited metrics.',
      'Outcome is described but not quantified.'
    ],
    concern: [
      'Vague or generic statements without a real example.',
      'Cannot describe what they personally did vs the team.',
      'No outcomes, timeline, or artifacts (repo/doc/PR) referenced.'
    ]
  };
}

function buildDeterministicQuestions(job: JobSnapshot, candidate: CandidateSnapshot): TruthCheckQuestion[] {
  const scorecard = computeMatchScorecard({ candidate, job });
  const missing = (scorecard.missingRequiredSkills || []).slice(0, 3);
  const required = (job.requiredSkills || []).filter(Boolean);

  const skillFocus = (missing.length ? missing : required).slice(0, 3);
  const rubric = defaultRubric();

  const questions: string[] = [
    ...skillFocus.map(
      (skill) =>
        `Describe the last time you used ${skill} to ship something to production. What did you build, what was the hardest part, and how did you validate it worked?`
    ),
    `Describe the last time you had to handle a high-stakes stakeholder or cross-functional conflict. What was the situation and what did you do?`,
    `Describe the last time you made (or influenced) a technical decision with tradeoffs. What were the options and why did you choose the final approach?`
  ];

  return questions.slice(0, 5).map((q, idx) => ({
    id: `tcq_${idx + 1}`,
    question: ensureDescribeLastTime(q),
    rubric
  }));
}

class TruthCheckService {
  buildDeterministic(params: { job: JobSnapshot; candidate: CandidateSnapshot }): TruthCheckPack {
    const { job, candidate } = params;
    return {
      version: 1,
      jobId: String(job.id),
      candidateId: String(candidate.id),
      questions: buildDeterministicQuestions(job, candidate),
      createdAt: new Date().toISOString(),
      method: 'deterministic'
    };
  }

  async build(params: { job: JobSnapshot; candidate: CandidateSnapshot; contextPack?: RoleContextPack | null }): Promise<TruthCheckPack> {
    const fallback = this.buildDeterministic(params);
    if (!aiService.isAvailable()) return fallback;

    const { job, candidate, contextPack } = params;

    const prompt = buildSecurePrompt({
      system: `You are Talent Sonar. Create a "Skills Truth Check" for a recruiter.

Constraints:
- Return ONLY valid JSON.
- Exactly 5 questions.
- Every question MUST start with "Describe the last time...".
- Each question must include a rubric with 3 bands: strong/adequate/concern.
- Questions must be tailored to the job and candidate; focus on hands-on proof.`,
      dataBlocks: [
        {
          label: 'JOB',
          content: [
            `Title: ${sanitizeShort(job.title)}`,
            `Required skills: ${sanitizeArray(job.requiredSkills || []).join(', ')}`,
            `Description: ${sanitizeForPrompt((job.description || '').slice(0, 1200), 1200)}`
          ].join('\n')
        },
        {
          label: 'ROLE_CONTEXT',
          content: contextPack?.answers ? sanitizeForPrompt(JSON.stringify(contextPack.answers), 900) : 'N/A'
        },
        {
          label: 'CANDIDATE',
          content: [
            `Name: ${sanitizeShort(candidate.name)}`,
            `Role: ${sanitizeShort(candidate.role ?? '', 160)}`,
            `Skills: ${sanitizeArray(candidate.skills || []).join(', ')}`,
            `Summary: ${sanitizeForPrompt(candidate.summary ?? '', 700)}`
          ].join('\n')
        }
      ],
      outputSpec: `Output schema:
{
  "version": 1,
  "jobId": "${job.id}",
  "candidateId": "${String(candidate.id)}",
  "questions": [
    { "id": "tcq_1", "question": "Describe the last time...", "rubric": { "strong": ["..."], "adequate": ["..."], "concern": ["..."] } },
    { "id": "tcq_2", "question": "...", "rubric": { ... } },
    { "id": "tcq_3", "question": "...", "rubric": { ... } },
    { "id": "tcq_4", "question": "...", "rubric": { ... } },
    { "id": "tcq_5", "question": "...", "rubric": { ... } }
  ],
  "createdAt": "${new Date().toISOString()}",
  "method": "ai"
}`
    });

    // Layer 6: Enforce structured output schema at the API level.
    const truthCheckSchema = {
      type: Type.OBJECT,
      properties: {
        version: { type: Type.NUMBER },
        jobId: { type: Type.STRING },
        candidateId: { type: Type.STRING },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING, description: 'Must start with "Describe the last time..."' },
              rubric: {
                type: Type.OBJECT,
                properties: {
                  strong: { type: Type.ARRAY, items: { type: Type.STRING } },
                  adequate: { type: Type.ARRAY, items: { type: Type.STRING } },
                  concern: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['strong', 'adequate', 'concern']
              }
            },
            required: ['id', 'question', 'rubric']
          }
        },
        createdAt: { type: Type.STRING },
        method: { type: Type.STRING }
      },
      required: ['version', 'jobId', 'candidateId', 'questions', 'createdAt', 'method']
    };

    const res = await aiService.generateJson<TruthCheckPack>(prompt, truthCheckSchema);
    if (!res.success || !res.data) return fallback;

    const pack = res.data as any;
    if (!pack || pack.version !== 1 || !Array.isArray(pack.questions) || pack.questions.length !== 5) return fallback;
    if (!pack.questions.every((q: any) => String(q.question || '').toLowerCase().startsWith('describe the last time'))) return fallback;

    // Layer 5: Validate AI output for prompt leakage and injection artifacts.
    const outputValidation = validateGenericOutput(pack);
    if (!outputValidation.valid) return fallback;

    return {
      ...pack,
      jobId: String(job.id),
      candidateId: String(candidate.id),
      createdAt: String(pack.createdAt || new Date().toISOString()),
      method: 'ai'
    } as TruthCheckPack;
  }
}

export const truthCheckService = new TruthCheckService();
