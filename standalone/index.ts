
import { MockCRMAdapter } from './adapters/MockCRMAdapter';
import { SourcingEngine } from './engine/SourcingEngine';
import { EvidenceExtractor } from './engine/EvidenceExtractor';
import { Job } from '../types';

/**
 * Main Sonar Standalone Instance.
 * This is what will be initialized in the GAS entry point.
 */
export class SonarStandalone {
    private engine: SourcingEngine;
    private extractor: EvidenceExtractor;

    constructor(adapter = new MockCRMAdapter()) {
        this.engine = new SourcingEngine(adapter);
        this.extractor = new EvidenceExtractor();
    }

    async runRediscovery(job: Job) {
        const matches = await this.engine.processRediscovery(job);
        if (!matches.success) return matches;

        // For the top 3 matches, extract deep evidence
        const results = [];
        for (const match of matches.data.slice(0, 3)) {
            const evidence = await this.extractor.extract(job, match.fullCandidate);
            results.push({
                ...match,
                evidence: evidence.success ? evidence.data : null
            });
        }

        return { success: true, data: results };
    }
}

export const sonarStandalone = new SonarStandalone();
