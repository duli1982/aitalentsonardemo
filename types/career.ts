export interface PathStep {
    roleTitle: string;
    durationMonths: number;
    requiredSkills: string[];
    description: string;
    type: 'ROLE' | 'PROJECT' | 'TRAINING';
}

export interface CareerPath {
    id: string;
    sourceRole: string;
    targetRole: string;
    steps: PathStep[];
    totalDurationMonths: number;
    feasibilityScore: number; // 0-100
    gapsToClose: string[];
}

export interface BuildVsBuyMetrics {
    role: string;
    build: {
        cost: number;
        timeMonths: number;
        retentionProb: number;
        notes?: string[];
    };
    buy: {
        cost: number;
        timeMonths: number;
        retentionProb: number;
        notes?: string[];
    };
    recommendation: 'BUILD' | 'BUY' | 'MIXED';
    assumptions?: string[];
}
