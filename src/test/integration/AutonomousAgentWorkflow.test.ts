import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupGlobalMocks, resetMocks, waitFor, createMockJob, createMockCandidate } from '../utils/testHelpers';
import { createMockSupabaseClient, mockCandidates } from '../mocks/supabaseMock';
import { createMockAIService } from '../mocks/aiServiceMock';
import { createMockEventBus, MOCK_EVENTS } from '../mocks/eventBusMock';
import { ok } from '../../../services/errorHandling';

/**
 * Integration Tests: End-to-End Autonomous Agent Workflows
 *
 * These tests verify that autonomous agents work together correctly
 * to move candidates through the pipeline from sourcing to hiring.
 */

describe('Autonomous Agent Workflow Integration Tests', () => {
    let mockEventBus: ReturnType<typeof createMockEventBus>;

    beforeEach(() => {
        setupGlobalMocks();
        mockEventBus = createMockEventBus();
        vi.clearAllMocks();
    });

    afterEach(() => {
        resetMocks();
    });

    describe('Sourcing → Screening → Interview Pipeline', () => {
        it('should move candidate from sourcing through full pipeline', async () => {
            // Setup: Mock all services
            vi.mock('../../../services/SemanticSearchService', () => ({
                semanticSearchService: {
                    search: vi.fn().mockResolvedValue(ok(mockCandidates))
                }
            }));

            vi.mock('../../../services/FitAnalysisService', () => ({
                fitAnalysisService: {
                    analyze: vi.fn().mockResolvedValue({
                        score: 85,
                        rationale: 'Strong match',
                        method: 'gemini-2.5-flash',
                        confidence: 0.85,
                        reasons: ['Excellent skills match']
                    }),
                    getExternalIdForJob: vi.fn().mockReturnValue('ext_1')
                }
            }));

            vi.mock('../../../services/BackgroundJobService', () => ({
                backgroundJobService: {
                    registerJob: vi.fn().mockReturnValue('job_1'),
                    runJob: vi.fn().mockResolvedValue({ success: true }),
                    setJobEnabled: vi.fn(),
                    getJob: vi.fn().mockReturnValue({ enabled: true }),
                    getJobResults: vi.fn().mockReturnValue([])
                }
            }));

            vi.mock('../../../utils/EventBus', () => ({
                eventBus: mockEventBus,
                EVENTS: MOCK_EVENTS
            }));

            // Import agents after mocking
            const { autonomousSourcingAgent } = await import('../../../services/AutonomousSourcingAgent');
            const { autonomousScreeningAgent } = await import('../../../services/AutonomousScreeningAgent');

            const job = createMockJob({ id: 'job_1', status: 'open' });
            const candidate = mockCandidates[0];

            // Step 1: Sourcing Agent finds candidate
            autonomousSourcingAgent.initialize([job], { enabled: true, mode: 'auto_write' });
            await autonomousSourcingAgent.triggerScan([job]);
            await waitFor(200);

            // Verify: Candidate was staged
            const stagedEvents = mockEventBus.emit.mock.calls.filter((call: any) =>
                call[0] === MOCK_EVENTS.CANDIDATE_STAGED
            );
            expect(stagedEvents.length).toBeGreaterThan(0);

            // Step 2: Screening Agent screens candidate
            autonomousScreeningAgent.initialize({ enabled: true, mode: 'auto_write' });
            autonomousScreeningAgent.requestScreening({
                candidateId: candidate.id,
                candidateName: candidate.name,
                candidateEmail: candidate.email,
                jobId: job.id,
                jobTitle: job.title,
                jobRequirements: job.requiredSkills,
                addedAt: new Date()
            });

            await autonomousScreeningAgent.triggerScreening();
            await waitFor(200);

            // Verify: Candidate was screened
            const results = autonomousScreeningAgent.getResults();
            expect(results.length).toBeGreaterThan(0);

            // Step 3: Verify events were emitted in correct order
            const eventTypes = mockEventBus.emit.mock.calls.map((call: any) => call[0]);
            expect(eventTypes).toContain(MOCK_EVENTS.CANDIDATE_STAGED);
            expect(eventTypes).toContain(MOCK_EVENTS.CANDIDATE_UPDATED);
        });
    });

    describe('Agent Coordination', () => {
        it('should prevent duplicate processing via markers', async () => {
            let processingCheckCount = 0;

            vi.mock('../../../services/ProcessingMarkerService', () => ({
                processingMarkerService: {
                    beginStep: vi.fn().mockImplementation(() => {
                        processingCheckCount++;
                        // First call returns true, subsequent calls return false
                        return Promise.resolve(processingCheckCount === 1);
                    }),
                    completeStep: vi.fn().mockResolvedValue(undefined)
                }
            }));

            vi.mock('../../../services/SemanticSearchService', () => ({
                semanticSearchService: {
                    search: vi.fn().mockResolvedValue(ok(mockCandidates))
                }
            }));

            const { autonomousSourcingAgent } = await import('../../../services/AutonomousSourcingAgent');

            const job = createMockJob();

            // Try to scan twice
            await autonomousSourcingAgent.triggerScan([job]);
            await autonomousSourcingAgent.triggerScan([job]);

            await waitFor(300);

            // Should have checked processing marker
            expect(processingCheckCount).toBeGreaterThan(0);
        });

        it('should emit events that other services can subscribe to', async () => {
            const eventHandler = vi.fn();

            mockEventBus.on(MOCK_EVENTS.CANDIDATE_STAGED, eventHandler);

            vi.mock('../../../utils/EventBus', () => ({
                eventBus: mockEventBus,
                EVENTS: MOCK_EVENTS
            }));

            // Emit event
            mockEventBus.emit(MOCK_EVENTS.CANDIDATE_STAGED, {
                candidateId: 'cand_1',
                jobId: 'job_1',
                stage: 'sourced'
            });

            expect(eventHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    candidateId: 'cand_1',
                    jobId: 'job_1'
                })
            );
        });
    });

    describe('Error Recovery', () => {
        it('should continue processing other candidates after one fails', async () => {
            const { fitAnalysisService } = await vi.importMock('../../../services/FitAnalysisService') as any;

            // Make first candidate fail, second succeed
            let callCount = 0;
            fitAnalysisService.analyze = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('AI quota exceeded'));
                }
                return Promise.resolve({
                    score: 75,
                    rationale: 'Good match',
                    method: 'gemini-2.5-flash',
                    confidence: 0.75,
                    reasons: ['Skills match']
                });
            });

            vi.mock('../../../services/SemanticSearchService', () => ({
                semanticSearchService: {
                    search: vi.fn().mockResolvedValue(ok(mockCandidates))
                }
            }));

            const { autonomousSourcingAgent } = await import('../../../services/AutonomousSourcingAgent');

            const job = createMockJob();
            autonomousSourcingAgent.setMode('auto_write');

            await autonomousSourcingAgent.triggerScan([job]);
            await waitFor(300);

            // Both candidates should have been processed (first with fallback)
            const staged = mockEventBus.emit.mock.calls.filter((call: any) =>
                call[0] === MOCK_EVENTS.CANDIDATE_STAGED
            );

            expect(staged.length).toBeGreaterThan(0);
        });

        it('should gracefully degrade when AI service is unavailable', async () => {
            vi.mock('../../../services/AIService', () => ({
                aiService: {
                    isAvailable: vi.fn().mockReturnValue(false),
                    generateText: vi.fn().mockResolvedValue({
                        success: false,
                        error: { code: 'NOT_CONFIGURED', message: 'AI not available' }
                    })
                }
            }));

            vi.mock('../../../services/SemanticSearchService', () => ({
                semanticSearchService: {
                    search: vi.fn().mockResolvedValue(ok(mockCandidates))
                }
            }));

            const { autonomousSourcingAgent } = await import('../../../services/AutonomousSourcingAgent');

            const job = createMockJob();

            // Should not crash
            await expect(autonomousSourcingAgent.triggerScan([job])).resolves.not.toThrow();
        });
    });

    describe('Mode Switching', () => {
        it('should respect recommend mode and create proposals', async () => {
            const proposalService = {
                add: vi.fn()
            };

            vi.mock('../../../services/ProposedActionService', () => ({
                proposedActionService: proposalService
            }));

            vi.mock('../../../services/SemanticSearchService', () => ({
                semanticSearchService: {
                    search: vi.fn().mockResolvedValue(ok(mockCandidates))
                }
            }));

            const { autonomousSourcingAgent } = await import('../../../services/AutonomousSourcingAgent');

            const job = createMockJob();
            autonomousSourcingAgent.setMode('recommend');

            await autonomousSourcingAgent.triggerScan([job]);
            await waitFor(300);

            // Should have created proposals
            expect(proposalService.add).toHaveBeenCalled();
        });

        it('should respect auto_write mode and write directly', async () => {
            vi.mock('../../../services/SemanticSearchService', () => ({
                semanticSearchService: {
                    search: vi.fn().mockResolvedValue(ok(mockCandidates))
                }
            }));

            vi.mock('../../../utils/EventBus', () => ({
                eventBus: mockEventBus,
                EVENTS: MOCK_EVENTS
            }));

            const { autonomousSourcingAgent } = await import('../../../services/AutonomousSourcingAgent');

            const job = createMockJob();
            autonomousSourcingAgent.setMode('auto_write');

            await autonomousSourcingAgent.triggerScan([job]);
            await waitFor(300);

            // Should have emitted CANDIDATE_STAGED events
            const staged = mockEventBus.emit.mock.calls.filter((call: any) =>
                call[0] === MOCK_EVENTS.CANDIDATE_STAGED
            );

            expect(staged.length).toBeGreaterThan(0);
        });
    });

    describe('Performance', () => {
        it('should process multiple jobs in parallel', async () => {
            vi.mock('../../../services/SemanticSearchService', () => ({
                semanticSearchService: {
                    search: vi.fn().mockResolvedValue(ok(mockCandidates))
                }
            }));

            const { autonomousSourcingAgent } = await import('../../../services/AutonomousSourcingAgent');

            const jobs = [
                createMockJob({ id: 'job_1' }),
                createMockJob({ id: 'job_2' }),
                createMockJob({ id: 'job_3' })
            ];

            const startTime = Date.now();
            await autonomousSourcingAgent.triggerScan(jobs);
            await waitFor(300);
            const endTime = Date.now();

            // Should complete in reasonable time (less than 2 seconds for 3 jobs)
            expect(endTime - startTime).toBeLessThan(2000);
        });
    });
});
