
import { CRMCandidate } from '../adapters/CRMAdapter';
import { Result, ok, err } from '../../types/result';
import { Job, EvidencePack } from '../../types';
import { aiService } from '../../services/AIService';
import { sanitizeForPrompt, sanitizeShort, buildSecurePrompt } from '../../utils/promptSecurity';

/**
 * Stateless Evidence Extractor.
 * Takes a candidate from a CRM and generates an Evidence Pack without DB storage.
 */
export class EvidenceExtractor {
    async extract(job: Job, candidate: CRMCandidate): Promise<Result<EvidencePack>> {
        if (!aiService.isAvailable()) {
            return err({ code: 'AI_UNAVAILABLE', message: 'Gemini AI is not configured.' });
        }

        const prompt = buildSecurePrompt({
            system: `You are Talent Sonar. Build a "Confidence Pack" for this candidate.
            Focus on EXPLAINABLE MATCHING. Why should the recruiter rediscover this person?`,
            dataBlocks: [
                {
                    label: 'JOB',
                    content: `Title: ${job.title}\nDescription: ${job.description}`
                },
                {
                    label: 'CANDIDATE',
                    content: `Name: ${candidate.name}\nRole: ${candidate.role}\nSkills: ${candidate.skills?.join(', ')}`
                },
                {
                    label: 'CRM_CONTEXT',
                    content: JSON.stringify(candidate.sourceRaw)
                }
            ],
            outputSpec: `Return a JSON object matching the EvidencePack interface.
            Include 3 "matchReasons" with snippets from the candidate's profile.`
        });

        // For the prototype, we use the existing aiService to call Gemini.
        const res = await aiService.generateJson<EvidencePack>(prompt);
        if (!res.success) return err(res.error);

        return ok({
            ...res.data,
            jobId: job.id,
            candidateId: candidate.id,
            createdAt: new Date().toISOString(),
            method: 'ai_standalone'
        } as EvidencePack);
    }
}
