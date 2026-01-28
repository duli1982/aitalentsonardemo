import { AgentRequest, AgentResponse } from '../types/agent';
import { graphEngine } from './GraphEngine';
import { AGENT_ROLES, ROLES } from '../types/ontology';
import { hasPermission, PERMISSIONS } from '../config/security';
import { ALL_JOBS } from '../data/jobs';
import { ALL_CANDIDATES } from '../data/candidates';
import type { Candidate, Job } from '../types';

export class AgentGateway {

    public async handleRequest(request: AgentRequest): Promise<AgentResponse> {
        // 1. Permission Check (PBAC)
        if (!this.checkPermissions(request)) {
            return {
                success: false,
                message: "Access Denied: You do not have permission to view this data."
            };
        }

        // 2. Intent Routing
        switch (request.intent) {
            case 'FIND_CANDIDATES':
                return this.handleFindCandidates(request);
            case 'FIND_CAREER_PATH':
                return this.handleFindCareerPath(request);
            default:
                return {
                    success: false,
                    message: "I'm sorry, I don't understand that request."
                };
        }
    }

    private safeReadLocalStorageJson<T>(key: string): T | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }

    private loadJobs(): Job[] {
        const fromStore = this.safeReadLocalStorageJson<Job[]>('talentSonar-jobs');
        if (Array.isArray(fromStore) && fromStore.length > 0) return fromStore;
        return ALL_JOBS;
    }

    private loadInternalCandidates(): Candidate[] {
        const fromStore = this.safeReadLocalStorageJson<Candidate[]>('talentSonar-internalCandidates');
        if (Array.isArray(fromStore) && fromStore.length > 0) return fromStore;
        return (ALL_CANDIDATES as Candidate[]).filter((c) => (c as any).type === 'internal');
    }

    private tokenize(input: string): string[] {
        return String(input || '')
            .toLowerCase()
            .replace(/[^a-z0-9+.#\s_-]/g, ' ')
            .replace(/[\s_-]+/g, ' ')
            .trim()
            .split(' ')
            .filter((t) => t.length >= 2);
    }

    private scoreJobAgainstQuery(job: Job, query: string): number {
        const q = new Set(this.tokenize(query));
        if (q.size === 0) return 0;

        const jobText = [job.title, job.department, job.location, ...(job.requiredSkills || [])].filter(Boolean).join(' ');
        const jt = new Set(this.tokenize(jobText));

        let hits = 0;
        for (const t of q) if (jt.has(t)) hits += 1;

        // Boost exact skill matches (query often includes skills).
        const required = (job.requiredSkills || []).map((s) => String(s).toLowerCase());
        const skillHits = required.filter((s) => q.has(s)).length;

        return hits + skillHits * 2;
    }

    private pickBestJob(query: string, jobs: Job[]): Job | null {
        if (!jobs.length) return null;
        const scored = jobs
            .map((j) => ({ job: j, score: this.scoreJobAgainstQuery(j, query) }))
            .sort((a, b) => b.score - a.score);

        // If query doesn't match anything, fall back to first open job or first job.
        const best = scored[0];
        if (best && best.score > 0) return best.job;
        return jobs.find((j) => String(j.status).toLowerCase() === 'open') ?? jobs[0];
    }

    private checkPermissions(request: AgentRequest): boolean {
        // Map Agent Intent to Required Permission
        const intentPermissionMap: Record<string, string> = {
            'FIND_CANDIDATES': PERMISSIONS.VIEW_INTERNAL_CANDIDATES,
            'FIND_CAREER_PATH': PERMISSIONS.VIEW_JOB_DETAILS, // SImple mapping
        };

        const requiredPermission = intentPermissionMap[request.intent];

        // If no strict permission required, allow? Or deny?
        // Let's assume some intents are public, but these two are protected.
        if (requiredPermission) {
            return hasPermission(request.context.role, requiredPermission as any);
        }

        return true;
    }

    private handleFindCandidates(request: AgentRequest): AgentResponse {
        const jobs = this.loadJobs();
        const internalCandidates = this.loadInternalCandidates();

        const selectedJob = this.pickBestJob(request.query, jobs);
        if (!selectedJob) {
            return { success: true, message: 'No jobs available to match against.', data: [] };
        }

        // Ensure the graph has the job + internal candidates.
        graphEngine.ingestJob(selectedJob);
        internalCandidates.forEach((c) => graphEngine.ingestCandidate(c));

        const matches = graphEngine.findTalentForRole(selectedJob.id);
        const internalIds = new Set(internalCandidates.map((c) => String(c.id)));
        const internalMatches = matches.filter((m) => internalIds.has(String(m.candidateId))).slice(0, 5);

        return {
            success: true,
            message: `I found ${internalMatches.length} internal candidates who could move into "${selectedJob.title}".`,
            data: internalMatches.map(m => ({
                id: m.candidateId,
                score: m.score,
                reason: m.explanation[0] // Brief reason
            }))
        };
    }

    private handleFindCareerPath(request: AgentRequest): AgentResponse {
        // Mocking "Show me internal roles where I can use my QC skills"

        const suggestions = [
            {
                role: ROLES.QA_LEAD,
                match: '90%',
                gap: 'None. Ready now.'
            },
            {
                role: ROLES.REGULATORY_SPECIALIST,
                match: '65%',
                gap: 'Needs certification in EU Regulations.'
            }
        ];

        return {
            success: true,
            message: "Based on your QC skills, here are 2 viable internal moves.",
            data: suggestions
        };
    }
}

export const agentGateway = new AgentGateway();
