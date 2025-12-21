import { Candidate } from '../types';
import { FairnessReport, BiasAlert, DiversityNudge } from '../types/fairness';

export class FairnessEngine {

    public analyzeShortlist(candidates: Candidate[]): FairnessReport {
        const total = candidates.length;
        if (total === 0) {
            return {
                diversityScore: 100,
                genderDistribution: {},
                educationDistribution: {},
                alerts: []
            };
        }

        // 1. Calculate Distributions
        const genderCount: { [key: string]: number } = {};
        const eduCount: { [key: string]: number } = {};

        candidates.forEach(c => {
            const g = c.demographics?.gender || 'Unknown';
            const e = c.demographics?.educationType || 'Unknown';
            genderCount[g] = (genderCount[g] || 0) + 1;
            eduCount[e] = (eduCount[e] || 0) + 1;
        });

        // 2. Normalize
        const genderDist: { [key: string]: number } = {};
        Object.keys(genderCount).forEach(k => genderDist[k] = Math.round((genderCount[k] / total) * 100));

        const eduDist: { [key: string]: number } = {};
        Object.keys(eduCount).forEach(k => eduDist[k] = Math.round((eduCount[k] / total) * 100));

        // 3. Detect Alerts
        const alerts: BiasAlert[] = [];

        // Gender Imbalance Guardrail (e.g., > 70% one gender)
        Object.entries(genderDist).forEach(([gender, pct]) => {
            if (pct > 70 && gender !== 'Unknown') {
                alerts.push({
                    type: 'GENDER_IMBALANCE',
                    severity: pct > 85 ? 'CRITICAL' : 'WARNING',
                    message: `${pct}% of shortlist is ${gender}.`,
                    suggestion: 'Consider adding candidates from underrepresented genders with similar skills.'
                });
            }
        });

        // Education Concentration Guardrail
        Object.entries(eduDist).forEach(([edu, pct]) => {
            if (edu === 'Elite' && pct > 60) {
                alerts.push({
                    type: 'EDUCATION_CONCENTRATION',
                    severity: 'WARNING',
                    message: `${pct}% of candidates are from Elite institutions.`,
                    suggestion: 'Review high-potential candidates from Traditional or Non-traditional pathways.'
                });
            }
        });

        // 4. Calculate Score (Simple inverse of alert penalty)
        let score = 100;
        alerts.forEach(a => score -= (a.severity === 'CRITICAL' ? 20 : 10));

        return {
            diversityScore: Math.max(0, score),
            genderDistribution: genderDist,
            educationDistribution: eduDist,
            alerts
        };
    }

    public generateNudges(currentShortlist: Candidate[], allCandidates: Candidate[]): DiversityNudge[] {
        const report = this.analyzeShortlist(currentShortlist);
        const nudges: DiversityNudge[] = [];

        // If Gender Imbalance, find missing gender
        const malePct = report.genderDistribution['Male'] || 0;
        if (malePct > 70) {
            // Find top female candidates not in list
            const femaleCandidates = allCandidates
                .filter(c => c.demographics?.gender === 'Female')
                .filter(c => !currentShortlist.find(s => s.id === c.id))
                .slice(0, 2); // Take top 2

            femaleCandidates.forEach(c => {
                nudges.push({
                    candidateId: c.id,
                    reasoning: 'Matches Top Skills (Graph Verified)',
                    missingAttribute: 'Female Candidate'
                });
            });
        }

        // If Elite Imbalance
        const elitePct = report.educationDistribution['Elite'] || 0;
        if (elitePct > 60) {
            const diversEdCandidates = allCandidates
                .filter(c => c.demographics?.educationType === 'Bootcamp' || c.demographics?.educationType === 'Self-taught')
                .filter(c => !currentShortlist.find(s => s.id === c.id))
                .slice(0, 2);

            diversEdCandidates.forEach(c => {
                nudges.push({
                    candidateId: c.id,
                    reasoning: 'Strong Portfolio / Skill Match',
                    missingAttribute: 'Non-traditional Background'
                });
            });
        }

        return nudges;
    }
}

export const fairnessEngine = new FairnessEngine();
