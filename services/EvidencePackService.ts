import { Type } from '@google/genai';
import type { CandidateSnapshot, EvidencePack, JobSnapshot, RoleContextPack } from '../types';
import { aiService } from './AIService';
import { computeMatchScorecard } from './MatchScorecardService';
import { sanitizeForPrompt, sanitizeArray, sanitizeShort, buildSecurePrompt } from '../utils/promptSecurity';
import { validateEvidencePack } from '../utils/outputValidation';
import { agenticTools } from './AgenticSearchTools';

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
  const summary = sanitizeForPrompt(candidate.summary, 900);
  const role = sanitizeShort(candidate.role, 160);

  return [
    `Name: ${sanitizeShort(candidate.name)}`,
    role ? `Role: ${role}` : '',
    candidate.location ? `Location: ${sanitizeShort(candidate.location)}` : '',
    Array.isArray(candidate.skills) && candidate.skills.length ? `Skills: ${sanitizeArray(candidate.skills.slice(0, 30)).join(', ')}` : '',
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

    // Step 1: Fact Check (Agentic Verification)
    // Heuristic: Extract the first "Company" looking string from the summary or role.
    // Real implementation would parse structure or ask LLM to extract "Latest Company".
    let verificationContext = "No verification data available.";
    const potentialCompany = candidate.role?.split(' at ')?.[1] || (candidate as any).metadata?.company;

    if (potentialCompany) {
      try {
        const verifyRes = await agenticTools.factChecker.execute({ company: potentialCompany, role: candidate.role });
        if (verifyRes.success && verifyRes.data.results.length > 0) {
          const peers = verifyRes.data.results;
          verificationContext = `Verified: We have ${verifyRes.data.metadata.peerCount} other candidates from ${potentialCompany} in the database.\n` +
            `Peer Examples: ${peers.map((p: any) => `${p.title}`).join(', ')}.\n` +
            `Use this to confirm if the candidate's skills align with other ${potentialCompany} hires.`;
        } else {
          verificationContext = `Verification Attempt: Found no other candidates from ${potentialCompany} in our database to validte against.`;
        }
      } catch (e) {
        console.warn('Fact check failed', e);
      }
    }

    const candidateText = getCandidateContext(candidate);
    const contextText = contextPack?.answers
      ? sanitizeForPrompt(JSON.stringify(contextPack.answers), 900)
      : '';

    const prompt = buildSecurePrompt({
      system: `You are Talent Sonar. Build an evidence-first mini pack for a recruiter to review.

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
- If evidence is missing, explicitly say so in "missing".`,
      dataBlocks: [
        {
          label: 'JOB',
          content: [
            `Title: ${sanitizeShort(job.title)}`,
            `Location: ${sanitizeShort(job.location)}`,
            `Required skills: ${sanitizeArray(job.requiredSkills || []).join(', ')}`,
            `Description: ${sanitizeForPrompt((job.description || '').slice(0, 1200), 1200)}`
          ].join('\n')
        },
        {
          label: 'ROLE_CONTEXT',
          content: contextText || 'N/A'
        },
        {
          label: 'VERIFICATION_DATA',
          content: verificationContext
        },
        {
          label: 'CANDIDATE',
          content: candidateText
        }
      ],
      outputSpec: `Output schema:
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
}`
    });

    // Layer 6: Enforce structured output schema at the API level.
    const evidenceSchema = {
      type: Type.OBJECT,
      properties: {
        version: { type: Type.NUMBER },
        jobId: { type: Type.STRING },
        candidateId: { type: Type.STRING },
        matchReasons: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              claim: { type: Type.STRING },
              snippet: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  source: { type: Type.STRING },
                  ref: { type: Type.STRING }
                },
                required: ['text', 'source']
              }
            },
            required: ['title', 'claim', 'snippet']
          }
        },
        risk: {
          type: Type.OBJECT,
          properties: {
            statement: { type: Type.STRING },
            mitigation: { type: Type.STRING }
          },
          required: ['statement', 'mitigation']
        },
        conspicuousOmissions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ['topic', 'reason']
          }
        },
        highStakesQuestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              expectedSignal: { type: Type.STRING },
              riskArea: { type: Type.STRING }
            },
            required: ['question', 'expectedSignal', 'riskArea']
          }
        },
        preMortemAnalysis: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              failureMode: { type: Type.STRING },
              probability: { type: Type.STRING },
              prevention: { type: Type.STRING }
            },
            required: ['failureMode', 'probability', 'prevention']
          }
        },
        referenceCheckGuide: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              context: { type: Type.STRING }
            },
            required: ['question', 'context']
          }
        },
        day90Trajectory: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              period: { type: Type.STRING },
              focus: { type: Type.STRING },
              potentialRisk: { type: Type.STRING }
            },
            required: ['period', 'focus', 'potentialRisk']
          }
        },
        truthCheckPreviewQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        missing: { type: Type.ARRAY, items: { type: Type.STRING } },
        confidence: { type: Type.NUMBER },
        createdAt: { type: Type.STRING },
        method: { type: Type.STRING }
      },
      required: [
        'version', 'jobId', 'candidateId', 'matchReasons', 'risk',
        'conspicuousOmissions', 'highStakesQuestions', 'preMortemAnalysis',
        'referenceCheckGuide', 'day90Trajectory', 'truthCheckPreviewQuestions',
        'missing', 'confidence', 'createdAt', 'method'
      ]
    };

    const res = await aiService.generateJson<EvidencePack>(prompt, evidenceSchema);
    if (!res.success || !res.data) return fallback;

    // Best-effort sanity checks
    const pack = res.data as any;
    if (!pack || pack.version !== 1) return fallback;
    if (!Array.isArray(pack.matchReasons) || pack.matchReasons.length !== 3) return fallback;
    if (!Array.isArray(pack.truthCheckPreviewQuestions) || pack.truthCheckPreviewQuestions.length !== 2) return fallback;

    // Layer 5: Validate AI output — check for leakage, injection artifacts, confidence anomalies.
    const validated = validateEvidencePack(pack);
    if (!validated.validation.valid) return fallback;

    return {
      ...pack,
      jobId: String(job.id),
      candidateId: String(candidate.id),
      confidence: validated.confidence,
      createdAt: String(pack.createdAt || new Date().toISOString()),
      method: 'ai'
    } as EvidencePack;
  }
}

export const evidencePackService = new EvidencePackService();
