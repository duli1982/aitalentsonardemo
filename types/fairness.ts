export interface FairnessReport {
    diversityScore: number; // 0-100
    genderDistribution: { [key: string]: number };
    educationDistribution: { [key: string]: number };
    alerts: BiasAlert[];
}

export interface BiasAlert {
    type: 'GENDER_IMBALANCE' | 'EDUCATION_CONCENTRATION' | 'AGE_BIAS';
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    suggestion: string;
}

export interface DiversityNudge {
    candidateId: string;
    reasoning: string;
    missingAttribute: string; // e.g., "Female", "Non-traditional Background"
}
