// Using vitest globals: describe, it, expect, beforeEach
import { InferenceEngine } from '../InferenceEngine';
import { SkillSignal } from '../../types/inference';

describe('InferenceEngine', () => {
    let engine: InferenceEngine;

    beforeEach(() => {
        engine = new InferenceEngine();
    });

    describe('inferSkillState', () => {
        it('should start with uninformative prior (50% mean)', () => {
            const result = engine.inferSkillState('skill_1', []);
            // With no evidence, should be around 50%
            expect(result.proficiencyMean).toBeGreaterThanOrEqual(40);
            expect(result.proficiencyMean).toBeLessThanOrEqual(60);
        });

        it('should update belief towards high-reliability evidence', () => {
            const signals: SkillSignal[] = [
                {
                    id: 'sig_1',
                    skillId: 'react',
                    sourceType: 'PROCTORED_EXAM',
                    sourceName: 'HackerRank',
                    timestamp: '2025-01-01T00:00:00Z',
                    rawScore: 95,
                    reliability: 0.95,
                    description: 'Passed with distinction'
                }
            ];

            const result = engine.inferSkillState('react', signals);
            // High reliability evidence should pull mean strongly toward 95
            expect(result.proficiencyMean).toBeGreaterThan(70);
        });

        it('should weight low-reliability evidence less', () => {
            const highReliabilitySignals: SkillSignal[] = [
                {
                    id: 'sig_1',
                    skillId: 'react',
                    sourceType: 'PROCTORED_EXAM',
                    sourceName: 'Exam',
                    timestamp: '2025-01-01T00:00:00Z',
                    rawScore: 90,
                    reliability: 0.95,
                    description: 'Exam'
                }
            ];

            const lowReliabilitySignals: SkillSignal[] = [
                {
                    id: 'sig_1',
                    skillId: 'react',
                    sourceType: 'SELF_ATTESTATION',
                    sourceName: 'LinkedIn',
                    timestamp: '2025-01-01T00:00:00Z',
                    rawScore: 90,
                    reliability: 0.1,
                    description: 'Self-claimed'
                }
            ];

            const highResult = engine.inferSkillState('react', highReliabilitySignals);
            const lowResult = engine.inferSkillState('react', lowReliabilitySignals);

            // Same raw score, but high reliability should move mean more
            expect(highResult.proficiencyMean).toBeGreaterThan(lowResult.proficiencyMean);
        });

        it('should accumulate evidence over multiple signals', () => {
            const singleSignal: SkillSignal[] = [
                {
                    id: 'sig_1',
                    skillId: 'python',
                    sourceType: 'CODE_REPOSITORY',
                    sourceName: 'GitHub',
                    timestamp: '2025-01-01T00:00:00Z',
                    rawScore: 85,
                    reliability: 0.7,
                    description: 'Code review'
                }
            ];

            const multipleSignals: SkillSignal[] = [
                ...singleSignal,
                {
                    id: 'sig_2',
                    skillId: 'python',
                    sourceType: 'PEER_REVIEW',
                    sourceName: 'Manager',
                    timestamp: '2025-02-01T00:00:00Z',
                    rawScore: 88,
                    reliability: 0.6,
                    description: 'Review'
                },
                {
                    id: 'sig_3',
                    skillId: 'python',
                    sourceType: 'PROCTORED_EXAM',
                    sourceName: 'Test',
                    timestamp: '2025-03-01T00:00:00Z',
                    rawScore: 90,
                    reliability: 0.9,
                    description: 'Exam'
                }
            ];

            const singleResult = engine.inferSkillState('python', singleSignal);
            const multipleResult = engine.inferSkillState('python', multipleSignals);

            // More evidence = narrower confidence interval
            expect(multipleResult.confidenceInterval).toBeLessThanOrEqual(singleResult.confidenceInterval);
        });

        it('should detect RISING trend', () => {
            const signals: SkillSignal[] = [
                {
                    id: 'sig_1',
                    skillId: 'sql',
                    sourceType: 'CODE_REPOSITORY',
                    sourceName: 'GitHub',
                    timestamp: '2024-01-01T00:00:00Z',
                    rawScore: 60,
                    reliability: 0.7,
                    description: 'Early'
                },
                {
                    id: 'sig_2',
                    skillId: 'sql',
                    sourceType: 'PEER_REVIEW',
                    sourceName: 'Manager',
                    timestamp: '2024-06-01T00:00:00Z',
                    rawScore: 75,
                    reliability: 0.6,
                    description: 'Mid'
                },
                {
                    id: 'sig_3',
                    skillId: 'sql',
                    sourceType: 'PROCTORED_EXAM',
                    sourceName: 'Test',
                    timestamp: '2025-01-01T00:00:00Z',
                    rawScore: 92,
                    reliability: 0.9,
                    description: 'Recent'
                }
            ];

            const result = engine.inferSkillState('sql', signals);
            expect(result.trend).toBe('RISING');
        });
    });

    describe('generateMockSignals', () => {
        it('should return array of signals', () => {
            const signals = engine.generateMockSignals('test_skill');
            expect(Array.isArray(signals)).toBe(true);
            expect(signals.length).toBeGreaterThan(0);
        });

        it('should include different source types', () => {
            const signals = engine.generateMockSignals('test_skill');
            const sourceTypes = new Set(signals.map(s => s.sourceType));
            expect(sourceTypes.size).toBeGreaterThan(1);
        });
    });

    describe('sampleFromPosterior', () => {
        it('should return requested number of samples', () => {
            const samples = engine.sampleFromPosterior({ alpha: 5, beta: 5 }, 50);
            expect(samples.length).toBe(50);
        });

        it('should return values between 0 and 100', () => {
            const samples = engine.sampleFromPosterior({ alpha: 2, beta: 2 }, 100);
            samples.forEach(s => {
                expect(s).toBeGreaterThanOrEqual(0);
                expect(s).toBeLessThanOrEqual(100);
            });
        });
    });
});
