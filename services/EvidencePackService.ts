import type { CandidateSnapshot, EvidencePack, JobSnapshot, RoleContextPack } from '../types';
import { aiService } from './AIService';
import { computeMatchScorecard } from './MatchScorecardService';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeText(input: unknown, maxLen: number): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function getCandidateContext(candidate: CandidateSnapshot): string {
  const summary = safeText(candidate.summary, 900);
  const role = safeText(candidate.role, 160);
  const companies = '';

  return [
    `Name: ${candidate.name}`,
    role ? `Role: ${role}` : '',
    companies ? `Companies: ${companies}` : '',
    candidate.location ? `Location: ${candidate.location}` : '',
    Array.isArray(candidate.skills) && candidate.skills.length ? `Skills: ${candidate.skills.slice(0, 30).join(', ')}` : '',
    summary ? `Summary: ${summary}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPreviewTruthQuestions(job: JobSnapshot, candidate: CandidateSnapshot, missing: string[]): string[] {
  const required = (job.requiredSkills || []).filter(Boolean);
  const top = (missing.length ? missing : required).slice(0, 2);

  const fallback = [
    `Describe the last time you shipped something impactful related to ${job.title}. What was your role and what changed because of it?`,
    `Describe the last time you had to collaborate with stakeholders outside your team. What was the situation and how did you handle it?`
  ];

  if (top.length === 0) return fallback;

  return top.map(
    (skill) =>
      `Describe the last time you used ${skill} in production. What did you build, what was the hardest part, and how did you know it worked?`
  );
}

function confidenceFromScorecard(scorecard: ReturnType<typeof computeMatchScorecard>): number {
  const skill = (scorecard.subscores?.skillFit ?? 50) / 100;
  const evidence = (scorecard.subscores?.evidenceQuality ?? 50) / 100;
  const seniority = (scorecard.subscores?.seniorityFit ?? 50) / 100;

  // Keep conservative by default; confidence rises with evidence quality.
  const raw = 0.15 + skill * 0.35 + evidence * 0.35 + seniority * 0.15;
  return clamp01(raw);
}

class EvidencePackService {
  buildDeterministic(params: { job: JobSnapshot; candidate: CandidateSnapshot; contextPack?: RoleContextPack | null }): EvidencePack {
    const { job, candidate } = params;
    const scorecard = computeMatchScorecard({ candidate, job });
    const createdAt = new Date().toISOString();
    const missing = (scorecard.missingRequiredSkills || []).slice(0, 8);
    const risks = (scorecard.risks || []).slice(0, 3);

    const snippetText = safeText((candidate as any).summary ?? (candidate as any).notes ?? (candidate as any).metadata?.content, 220);
    const snippet = snippetText
      ? { text: snippetText, source: 'profile' as const }
      : undefined;

    const matchReasons = [
      {
        title: 'Skill alignment',
        claim: scorecard.matchedSkills.length
          ? `Matches ${scorecard.matchedSkills.slice(0, 6).join(', ')}.`
          : 'No direct skill overlap found; relying on semantic/domain signals.',
        snippet
      },
      {
        title: 'Role & seniority',
        claim: `Expected seniority: ${scorecard.expectedSeniority}. Inferred: ${scorecard.inferredSeniority}.`,
        snippet
      },
      {
        title: 'Evidence signals',
        claim:
          scorecard.evidence.length > 0
            ? scorecard.evidence
              .slice(0, 2)
              .map((e) => e.title)
              .filter(Boolean)
              .join(' · ')
            : 'Limited structured evidence found in profile; recommend truth-check.',
        snippet
      }
    ];

    const riskStatement =
      risks.length > 0
        ? risks[0]
        : missing.length > 0
          ? `Missing proof of ${missing[0]}.`
          : 'No major risk flags detected.';

    const mitigation =
      missing.length > 0
        ? `Truth-check ${missing[0]} with a “last time you did X” question and request a concrete artifact (repo, PR, doc, or metrics).`
        : 'Proceed with a truth-check focused on recent, concrete examples and measurable outcomes.';

    const confidence = confidenceFromScorecard(scorecard);
    const truthCheckPreviewQuestions = buildPreviewTruthQuestions(job, candidate, missing);

    const missingSignals: string[] = [];
    if (missing.length > 0) missingSignals.push(...missing.map((m) => `Missing proof of ${m}`));
    if (scorecard.inferredSeniority === 'unknown') missingSignals.push('Seniority timeline unclear');
    if ((scorecard.subscores?.evidenceQuality ?? 0) < 45) missingSignals.push('Evidence quality low (resume/profile lacks concrete receipts)');

    return {
      version: 1,
      jobId: job.id,
      candidateId: String(candidate.id),
      matchReasons,
      risk: { statement: riskStatement, mitigation },
      truthCheckPreviewQuestions,
      missing: missingSignals.slice(0, 6),
      confidence,
      createdAt,
      method: 'deterministic',
      conspicuousOmissions: [],
      highStakesQuestions: [],
      preMortemAnalysis: [],
      referenceCheckGuide: [],
      day90Trajectory: []
    };
  }

  async build(params: { job: JobSnapshot; candidate: CandidateSnapshot; contextPack?: RoleContextPack | null }): Promise<EvidencePack> {
    const fallback = this.buildDeterministic(params);
    if (!aiService.isAvailable()) return fallback;

    const { job, candidate, contextPack } = params;
    const candidateText = getCandidateContext(candidate);
    const contextText = contextPack?.answers
      ? safeText(JSON.stringify(contextPack.answers), 900)
      : '';

    const prompt = `
You are Talent Sonar. Build an evidence-first mini pack for a recruiter to review.

Constraints:
- Return ONLY valid JSON.
- "matchReasons" MUST be exactly 3 items, each with: title, claim, snippet{text,source,ref?}.
- "truthCheckPreviewQuestions" MUST be exactly 2 questions and MUST start with "Describe the last time...".
- "risk" MUST include a mitigation step.
- "preMortemAnalysis": Identify 1-2 realistic failure scenarios (e.g., "Culture clash", "Burnout"). Include probability (Low/Med/High) and prevention.
- "referenceCheckGuide": Generate 2 specific questions for a former manager to validate the identified risks.
- "day90Trajectory": Forecast the first 90 days. What is the main focus and what is the friction point at 30, 60, and 90 days?
- "conspicuousOmissions": Identify 1-2 skills/achievements expected for this role/seniority but MISSING (e.g., "Senior dev with no mentorship exp").
- "highStakesQuestions": Generate 2 behavioral questions probing the biggest risks.
- If evidence is missing, explicitly say so in "missing".

Job:
- Title: ${job.title}
- Location: ${job.location}
- Required skills: ${(job.requiredSkills || []).join(', ')}
- Description: ${(job.description || '').slice(0, 1200)}

Role Context Pack (optional):
${contextText || 'N/A'}

Candidate:
${candidateText}

Output schema:
{
  "version": 1,
  "jobId": "${job.id}",
  "candidateId": "${String(candidate.id)}",
  "matchReasons": [
    { "title": "string", "claim": "string", "snippet": { "text": "string", "source": "profile|resume|supabase_document|manual_note|inferred", "ref": "string?" } },
    { "title": "string", "claim": "string", "snippet": { "text": "string", "source": "profile|resume|supabase_document|manual_note|inferred", "ref": "string?" } },
    { "title": "string", "claim": "string", "snippet": { "text": "string", "source": "profile|resume|supabase_document|manual_note|inferred", "ref": "string?" } }
  ],
  "risk": { "statement": "string", "mitigation": "string" },
  "conspicuousOmissions": [
    { "topic": "string", "reason": "why it matters" }
  ],
  "highStakesQuestions": [
    { "question": "string", "expectedSignal": "string", "riskArea": "string" }
  ],
  "preMortemAnalysis": [
    { "failureMode": "string", "probability": "Low|Medium|High", "prevention": "string" }
  ],
  "referenceCheckGuide": [
    { "question": "string", "context": "why ask this" }
  ],
  "day90Trajectory": [
    { "period": "30 days", "focus": "string", "potentialRisk": "string" },
    { "period": "60 days", "focus": "string", "potentialRisk": "string" },
    { "period": "90 days", "focus": "string", "potentialRisk": "string" }
  ],
  "truthCheckPreviewQuestions": ["Describe the last time ...", "Describe the last time ..."],
  "missing": ["string"],
  "confidence": 0.0,
  "createdAt": "${new Date().toISOString()}",
  "method": "ai"
}
`;

    const res = await aiService.generateJson<EvidencePack>(prompt);
    if (!res.success || !res.data) return fallback;

    // Best-effort sanity checks
    const pack = res.data as any;
    if (!pack || pack.version !== 1) return fallback;
    if (!Array.isArray(pack.matchReasons) || pack.matchReasons.length !== 3) return fallback;
    if (!Array.isArray(pack.truthCheckPreviewQuestions) || pack.truthCheckPreviewQuestions.length !== 2) return fallback;

    return {
      ...pack,
      jobId: String(job.id),
      candidateId: String(candidate.id),
      createdAt: String(pack.createdAt || new Date().toISOString()),
      method: 'ai'
    } as EvidencePack;
  }
}

export const evidencePackService = new EvidencePackService();
