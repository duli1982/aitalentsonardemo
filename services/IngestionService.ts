import { SkillSignal } from '../types/inference';

export class IngestionService {

    // Simulates an LLM parsing unstructured text into structured skill signals
    public async ingestText(text: string, source: string): Promise<SkillSignal[]> {
        console.log(`Ingesting text from ${source}:`, text.substring(0, 50) + '...');

        // Mock delay for AI processing
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock Result: Assume the text always contains some "Python" evidence for the demo
        const isPythonReference = text.toLowerCase().includes('python') || text.toLowerCase().includes('pandas');
        const isLeadershipReference = text.toLowerCase().includes('team') || text.toLowerCase().includes('led');

        const signals: SkillSignal[] = [];

        if (isPythonReference) {
            signals.push({
                id: `ingest_${Date.now()}_1`,
                skillId: 'Python',
                sourceType: 'SOCIAL_PROOF', // Inferred from email/text
                sourceName: `Ingested from ${source}`,
                timestamp: new Date().toISOString(),
                rawScore: 70,
                reliability: 0.4, // Unstructured is lower reliability
                description: 'Detected mention of Python usage in provided text.'
            });
        }

        if (isLeadershipReference) {
            signals.push({
                id: `ingest_${Date.now()}_2`,
                skillId: 'Technical Leadership',
                sourceType: 'PEER_REVIEW',
                sourceName: `Ingested from ${source}`,
                timestamp: new Date().toISOString(),
                rawScore: 85,
                reliability: 0.5,
                description: 'Sentiment analysis detected strong leadership themes.'
            });
        }

        return signals;
    }
}

export const ingestionService = new IngestionService();
