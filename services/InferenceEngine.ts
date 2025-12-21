import { SkillBelief, SkillSignal, SOURCE_RELIABILITY, SignalSourceType } from '../types/inference';

// Beta Distribution Parameters for Bayesian Inference
interface BetaPrior {
    alpha: number; // Successes + prior
    beta: number;  // Failures + prior
}

export class InferenceEngine {

    // Beta distribution update: P(skill|evidence) ∝ P(evidence|skill) * P(skill)
    private updateBeta(prior: BetaPrior, observation: number, reliability: number): BetaPrior {
        // Scale observation from 0-100 to 0-1
        const normalizedScore = observation / 100;

        // Weight the update by reliability
        const effectiveObservations = reliability * 10; // Higher reliability = more "virtual samples"

        return {
            alpha: prior.alpha + normalizedScore * effectiveObservations,
            beta: prior.beta + (1 - normalizedScore) * effectiveObservations
        };
    }

    // Calculate mean of Beta distribution
    private betaMean(params: BetaPrior): number {
        return params.alpha / (params.alpha + params.beta);
    }

    // Calculate 95% credible interval using normal approximation
    private betaCredibleInterval(params: BetaPrior): { lower: number; upper: number } {
        const mean = this.betaMean(params);
        const variance = (params.alpha * params.beta) /
            (Math.pow(params.alpha + params.beta, 2) * (params.alpha + params.beta + 1));
        const std = Math.sqrt(variance);

        // 95% CI ≈ mean ± 1.96 * std
        return {
            lower: Math.max(0, (mean - 1.96 * std) * 100),
            upper: Math.min(100, (mean + 1.96 * std) * 100)
        };
    }

    // Apply time-based skill decay (half-life model)
    private applyDecay(params: BetaPrior, daysSinceLastEvidence: number): BetaPrior {
        const HALF_LIFE_DAYS = 365; // Skills decay by ~50% confidence per year without reinforcement
        const decayFactor = Math.pow(0.5, daysSinceLastEvidence / HALF_LIFE_DAYS);

        // Decay moves prior toward uninformative (alpha=1, beta=1)
        const uninformativeAlpha = 1;
        const uninformativeBeta = 1;

        return {
            alpha: uninformativeAlpha + (params.alpha - uninformativeAlpha) * decayFactor,
            beta: uninformativeBeta + (params.beta - uninformativeBeta) * decayFactor
        };
    }

    // Monte Carlo sampling for uncertainty visualization
    public sampleFromPosterior(params: BetaPrior, numSamples: number = 100): number[] {
        // Simple rejection sampling approximation
        const samples: number[] = [];

        for (let i = 0; i < numSamples; i++) {
            // Box-Muller approximation for Beta distribution
            const u1 = Math.random();
            const u2 = Math.random();

            // Approximation using Beta distribution properties
            const gammaA = this.sampleGamma(params.alpha);
            const gammaB = this.sampleGamma(params.beta);
            const sample = gammaA / (gammaA + gammaB);

            samples.push(sample * 100);
        }

        return samples;
    }

    // Simple Gamma sampling (Marsaglia's method)
    private sampleGamma(shape: number): number {
        if (shape < 1) {
            return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
        }

        const d = shape - 1 / 3;
        const c = 1 / Math.sqrt(9 * d);

        while (true) {
            let x, v;
            do {
                x = this.sampleNormal();
                v = 1 + c * x;
            } while (v <= 0);

            v = v * v * v;
            const u = Math.random();

            if (u < 1 - 0.0331 * x * x * x * x) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
    }

    private sampleNormal(): number {
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    // Main inference method - True Bayesian
    public inferSkillState(skillId: string, signals: SkillSignal[]): SkillBelief {
        // Sort signals by time (oldest first)
        const sortedSignals = [...signals].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Start with uninformative prior: Beta(1, 1) = Uniform
        let posterior: BetaPrior = { alpha: 1, beta: 1 };

        // Bayesian update for each signal
        sortedSignals.forEach(signal => {
            const reliability = signal.reliability || SOURCE_RELIABILITY[signal.sourceType] || 0.5;
            posterior = this.updateBeta(posterior, signal.rawScore, reliability);
        });

        // Apply decay based on time since last evidence
        const lastSignalTime = sortedSignals.length > 0
            ? new Date(sortedSignals[sortedSignals.length - 1].timestamp)
            : new Date();
        const daysSinceLastEvidence = (Date.now() - lastSignalTime.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastEvidence > 30) {
            posterior = this.applyDecay(posterior, daysSinceLastEvidence);
        }

        // Calculate statistics
        const mean = this.betaMean(posterior) * 100;
        const ci = this.betaCredibleInterval(posterior);
        const confidenceInterval = (ci.upper - ci.lower) / 2;

        // Determine trend from recent signals
        const recentSignals = sortedSignals.slice(-3);
        const recentAverage = recentSignals.reduce((acc, s) => acc + s.rawScore, 0) / (recentSignals.length || 1);
        let trend: 'RISING' | 'STABLE' | 'DECAYING' = 'STABLE';

        if (recentAverage > mean + 5) trend = 'RISING';
        else if (recentAverage < mean - 5 || daysSinceLastEvidence > 180) trend = 'DECAYING';

        return {
            skillId,
            proficiencyMean: Math.round(mean),
            confidenceInterval: Math.round(confidenceInterval),
            lastUpdated: new Date().toISOString(),
            evidenceChain: sortedSignals.reverse(),
            trend
        };
    }

    public generateMockSignals(skillId: string): SkillSignal[] {
        return [
            {
                id: 'sig_1',
                skillId,
                sourceType: 'SELF_ATTESTATION',
                sourceName: 'LinkedIn Profile',
                timestamp: '2023-01-15T10:00:00Z',
                rawScore: 90,
                reliability: 0.1,
                description: 'Claimed "Expert" on LinkedIn'
            },
            {
                id: 'sig_2',
                skillId,
                sourceType: 'CODE_REPOSITORY',
                sourceName: 'GitHub Analysis',
                timestamp: '2023-06-20T14:30:00Z',
                rawScore: 75,
                reliability: 0.75,
                description: 'Analyzed 15 PRs in React repo. Good modularity.'
            },
            {
                id: 'sig_3',
                skillId,
                sourceType: 'PEER_REVIEW',
                sourceName: '360 Feedback (Sarah J.)',
                timestamp: '2024-02-10T09:00:00Z',
                rawScore: 88,
                reliability: 0.6,
                description: 'Commended for complex state management logic.'
            },
            {
                id: 'sig_4',
                skillId,
                sourceType: 'PROCTORED_EXAM',
                sourceName: 'HackerRank (Advanced)',
                timestamp: '2025-11-05T16:00:00Z',
                rawScore: 94,
                reliability: 0.95,
                description: 'Passed "React 19 Architecture" certification w/ Distinction.'
            }
        ];
    }
}

export const inferenceEngine = new InferenceEngine();
