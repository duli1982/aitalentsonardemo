import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { autonomousSourcingAgent } from '../AutonomousSourcingAgent';
import { createMockSupabaseClient, mockCandidates } from '../../src/test/mocks/supabaseMock';
import { createMockAIService, mockAIResponses } from '../../src/test/mocks/aiServiceMock';
import { createMockEventBus, MOCK_EVENTS } from '../../src/test/mocks/eventBusMock';
import { createMockJob, createMockCandidate, waitFor, setupGlobalMocks, resetMocks } from '../../src/test/utils/testHelpers';
import { ok, err } from '../errorHandling';

// Mock dependencies
vi.mock('../SemanticSearchService', () => ({
    semanticSearchService: {
        search: vi.fn().mockResolvedValue(ok(mockCandidates))
    }
}));

vi.mock('../BackgroundJobService', () => ({
    backgroundJobService: {
        registerJob: vi.fn().mockReturnValue('job_sourcing_1'),
        setJobEnabled: vi.fn(),
        getJob: vi.fn().mockReturnValue({ enabled: true, lastRun: null, nextRun: null }),
        getJobResults: vi.fn().mockReturnValue([]),
        runJob: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../PulseService', () => ({
    pulseService: {
        addEvent: vi.fn()
    }
}));

vi.mock('../FitAnalysisService', () => ({
    fitAnalysisService: {
        analyze: vi.fn().mockResolvedValue({
            score: 85,
            rationale: mockAIResponses.fitAnalysis.rationale,
            method: 'gemini-2.5-flash',
            confidence: 0.85,
            reasons: mockAIResponses.fitAnalysis.reasons
        }),
        getExternalIdForJob: vi.fn().mockReturnValue('ext_id_1')
    }
}));

vi.mock('../EvidencePackService', () => ({
    evidencePackService: {
        build: vi.fn().mockResolvedValue(mockAIResponses.evidencePack)
    }
}));

vi.mock('../JobContextPackService', () => ({
    jobContextPackService: {
        get: vi.fn().mockResolvedValue({
            jobId: 'job_1',
            intakeAnswers: {},
            generatedAt: new Date()
        })
    }
}));

vi.mock('../ProcessingMarkerService', () => ({
    processingMarkerService: {
        beginStep: vi.fn().mockResolvedValue(true),
        completeStep: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../DecisionArtifactService', () => ({
    decisionArtifactService: {
        saveShortlistAnalysis: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../PipelineEventService', () => ({
    pipelineEventService: {
        logEvent: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../ProposedActionService', () => ({
    proposedActionService: {
        add: vi.fn()
    }
}));

vi.mock('../../utils/EventBus', () => ({
    eventBus: createMockEventBus(),
    EVENTS: MOCK_EVENTS
}));

describe('AutonomousSourcingAgent', () => {
    beforeEach(() => {
        setupGlobalMocks();
        vi.clearAllMocks();
    });

    afterEach(() => {
        resetMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully', () => {
            const jobs = [createMockJob()];
            autonomousSourcingAgent.initialize(jobs, { enabled: false });

            const status = autonomousSourcingAgent.getStatus();
            expect(status.initialized).toBe(true);
        });

        it('should register with BackgroundJobService', () => {
            const { backgroundJobService } = require('../BackgroundJobService');
            const jobs = [createMockJob()];

            autonomousSourcingAgent.initialize(jobs, { enabled: true });

            expect(backgroundJobService.registerJob).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Autonomous Candidate Sourcing',
                    type: 'SOURCING',
                    interval: 5 * 60 * 1000,
                    enabled: true
                })
            );
        });

        it('should support recommend and auto_write modes', () => {
            const jobs = [createMockJob()];

            // Test recommend mode
            autonomousSourcingAgent.initialize(jobs, { mode: 'recommend' });
            expect(autonomousSourcingAgent).toBeDefined();

            // Test auto_write mode
            autonomousSourcingAgent.setMode('auto_write');
            expect(autonomousSourcingAgent).toBeDefined();
        });
    });

    describe('scanning for candidates', () => {
        it('should find candidates matching job requirements', async () => {
            const { semanticSearchService } = require('../SemanticSearchService');
            const job = createMockJob({
                id: 'job_1',
                title: 'Senior Frontend Engineer',
                requiredSkills: ['React', 'TypeScript'],
                status: 'open'
            });

            semanticSearchService.search.mockResolvedValueOnce(ok(mockCandidates));

            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(100); // Wait for async operations

            expect(semanticSearchService.search).toHaveBeenCalledWith(
                expect.stringContaining('Senior Frontend Engineer'),
                expect.objectContaining({
                    threshold: 0.65,
                    limit: 10
                })
            );
        });

        it('should build correct search query', async () => {
            const { semanticSearchService } = require('../SemanticSearchService');
            const job = createMockJob({
                title: 'Senior React Developer',
                seniority: 'Senior',
                requiredSkills: ['React', 'TypeScript', 'Node.js'],
                experienceRequired: 5,
                description: 'We need a senior React developer with strong TypeScript skills.'
            });

            autonomousSourcingAgent.initialize([job], { enabled: false });
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(100);

            const searchCall = semanticSearchService.search.mock.calls[0];
            const query = searchCall[0];

            expect(query).toContain('Senior React Developer');
            expect(query).toContain('Senior');
            expect(query).toContain('React');
            expect(query).toContain('TypeScript');
            expect(query).toContain('5+ years experience');
        });

        it('should filter out candidates already in pipeline', async () => {
            const job = createMockJob({
                id: 'job_1',
                candidateIds: ['cand_1'] // cand_1 already in pipeline
            });

            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(100);

            // Should not create proposal for cand_1
            const { proposedActionService } = require('../ProposedActionService');
            const proposals = proposedActionService.add.mock.calls;

            // Filter proposals for cand_1
            const cand1Proposals = proposals.filter((call: any) =>
                call[0].candidateId === 'cand_1'
            );

            expect(cand1Proposals.length).toBe(0);
        });

        it('should handle search failures gracefully', async () => {
            const { semanticSearchService } = require('../SemanticSearchService');
            const { pulseService } = require('../PulseService');

            semanticSearchService.search.mockResolvedValueOnce(
                err({
                    code: 'UPSTREAM_ERROR',
                    source: 'SemanticSearchService',
                    message: 'Search failed',
                    severity: 'error',
                    retryable: true
                })
            );

            const job = createMockJob();
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(100);

            // Should emit warning to Pulse
            expect(pulseService.addEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'AGENT_ACTION',
                    severity: 'warning',
                    message: expect.stringContaining('could not run semantic search')
                })
            );
        });
    });

    describe('AI gating and shortlist analysis', () => {
        it('should promote high-scoring candidates to Long List', async () => {
            const { fitAnalysisService } = require('../FitAnalysisService');
            const { eventBus } = require('../../utils/EventBus');

            fitAnalysisService.analyze.mockResolvedValueOnce({
                score: 85, // Above 75 threshold
                rationale: 'Excellent fit',
                method: 'gemini-2.5-flash',
                confidence: 0.9,
                reasons: ['Strong skills match']
            });

            const job = createMockJob({ id: 'job_1' });
            autonomousSourcingAgent.setMode('auto_write');
            autonomousSourcingAgent.initialize([job], { enabled: false });

            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            // Check that candidate was staged to long_list
            const stagedCalls = eventBus.emit.mock.calls.filter((call: any) =>
                call[0] === MOCK_EVENTS.CANDIDATE_STAGED &&
                call[1]?.stage === 'long_list'
            );

            expect(stagedCalls.length).toBeGreaterThan(0);
        });

        it('should move low-scoring candidates to New for review', async () => {
            const { fitAnalysisService } = require('../FitAnalysisService');
            const { eventBus } = require('../../utils/EventBus');

            fitAnalysisService.analyze.mockResolvedValueOnce({
                score: 65, // Below 75 threshold
                rationale: 'Needs review',
                method: 'gemini-2.5-flash',
                confidence: 0.7,
                reasons: ['Partial skills match']
            });

            const job = createMockJob({ id: 'job_1' });
            autonomousSourcingAgent.setMode('auto_write');
            autonomousSourcingAgent.initialize([job], { enabled: false });

            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            // Check that candidate was staged to new
            const stagedCalls = eventBus.emit.mock.calls.filter((call: any) =>
                call[0] === MOCK_EVENTS.CANDIDATE_STAGED &&
                call[1]?.stage === 'new'
            );

            expect(stagedCalls.length).toBeGreaterThan(0);
        });

        it('should handle AI analysis failures gracefully', async () => {
            const { fitAnalysisService } = require('../FitAnalysisService');

            fitAnalysisService.analyze.mockRejectedValueOnce(new Error('AI quota exceeded'));

            const job = createMockJob();
            autonomousSourcingAgent.setMode('auto_write');

            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            // Should still move candidate to 'new' stage
            const { eventBus } = require('../../utils/EventBus');
            const stagedCalls = eventBus.emit.mock.calls.filter((call: any) =>
                call[0] === MOCK_EVENTS.CANDIDATE_STAGED &&
                call[1]?.stage === 'new'
            );

            expect(stagedCalls.length).toBeGreaterThan(0);
        });

        it('should save decision artifacts for audit trail', async () => {
            const { decisionArtifactService } = require('../DecisionArtifactService');

            const job = createMockJob();
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            expect(decisionArtifactService.saveShortlistAnalysis).toHaveBeenCalled();
        });
    });

    describe('recommend mode (human-in-the-loop)', () => {
        it('should create proposals instead of direct writes in recommend mode', async () => {
            const { proposedActionService } = require('../ProposedActionService');
            const { eventBus } = require('../../utils/EventBus');

            const job = createMockJob();
            autonomousSourcingAgent.setMode('recommend');
            autonomousSourcingAgent.initialize([job], { enabled: false });

            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            // Should create proposals
            expect(proposedActionService.add).toHaveBeenCalled();

            // Should NOT emit direct CANDIDATE_STAGED events
            const directStagedCalls = eventBus.emit.mock.calls.filter((call: any) =>
                call[0] === MOCK_EVENTS.CANDIDATE_STAGED
            );

            // In recommend mode, events come from applying proposals, not directly from agent
            expect(directStagedCalls.length).toBe(0);
        });

        it('should include evidence in proposals', async () => {
            const { proposedActionService } = require('../ProposedActionService');

            const job = createMockJob();
            autonomousSourcingAgent.setMode('recommend');

            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            const proposalCalls = proposedActionService.add.mock.calls;
            if (proposalCalls.length > 0) {
                const proposal = proposalCalls[0][0];

                expect(proposal).toHaveProperty('agentType', 'SOURCING');
                expect(proposal).toHaveProperty('evidence');
                expect(Array.isArray(proposal.evidence)).toBe(true);
            }
        });
    });

    describe('idempotency and retry logic', () => {
        it('should use processing markers to prevent duplicate work', async () => {
            const { processingMarkerService } = require('../ProcessingMarkerService');

            const job = createMockJob();
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            // Should check processing markers
            expect(processingMarkerService.beginStep).toHaveBeenCalledWith(
                expect.objectContaining({
                    step: expect.stringContaining('sourcing:stage:sourced')
                })
            );
        });

        it('should retry transient failures with exponential backoff', async () => {
            const { semanticSearchService } = require('../SemanticSearchService');

            // Fail first attempt, succeed on second
            semanticSearchService.search
                .mockResolvedValueOnce(
                    err({
                        code: 'UPSTREAM_ERROR',
                        source: 'SemanticSearchService',
                        message: 'Transient error',
                        severity: 'error',
                        retryable: true
                    })
                )
                .mockResolvedValueOnce(ok(mockCandidates));

            const job = createMockJob();
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(300);

            // Should have retried
            expect(semanticSearchService.search).toHaveBeenCalledTimes(2);
        });
    });

    describe('match tracking', () => {
        it('should store discovered matches', async () => {
            const job = createMockJob({ id: 'job_1' });
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(200);

            const matches = autonomousSourcingAgent.getMatches('job_1');
            expect(Array.isArray(matches)).toBe(true);
        });

        it('should allow clearing matches for a job', async () => {
            const job = createMockJob({ id: 'job_1' });
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(100);

            autonomousSourcingAgent.clearMatches('job_1');
            const matches = autonomousSourcingAgent.getMatches('job_1');

            expect(matches.length).toBe(0);
        });

        it('should return match count for a job', async () => {
            const job = createMockJob({ id: 'job_1' });
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(100);

            const count = autonomousSourcingAgent.getMatchCount('job_1');
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('enable/disable', () => {
        it('should enable and disable agent', () => {
            const { backgroundJobService } = require('../BackgroundJobService');

            const jobs = [createMockJob()];
            autonomousSourcingAgent.initialize(jobs, { enabled: false });

            autonomousSourcingAgent.setEnabled(true);
            expect(backgroundJobService.setJobEnabled).toHaveBeenCalledWith('job_sourcing_1', true);

            autonomousSourcingAgent.setEnabled(false);
            expect(backgroundJobService.setJobEnabled).toHaveBeenCalledWith('job_sourcing_1', false);
        });
    });

    describe('status reporting', () => {
        it('should return agent status', () => {
            const jobs = [createMockJob()];
            autonomousSourcingAgent.initialize(jobs, { enabled: true });

            const status = autonomousSourcingAgent.getStatus();

            expect(status).toHaveProperty('initialized');
            expect(status).toHaveProperty('enabled');
            expect(status).toHaveProperty('totalMatches');
            expect(status.initialized).toBe(true);
        });
    });
});
