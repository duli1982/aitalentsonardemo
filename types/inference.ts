export type SignalSourceType =
    | 'PROCTORED_EXAM'
    | 'CODE_REPOSITORY'
    | 'PEER_REVIEW'
    | 'PROJECT_DELIVERY'
    | 'SOCIAL_PROOF'
    | 'SELF_ATTESTATION';

export interface SkillSignal {
    id: string;
    skillId: string;
    sourceType: SignalSourceType;
    sourceName: string; // e.g. "GitHub", "HackerRank"
    timestamp: string;
    rawScore: number; // Normalized 0-100
    reliability: number; // 0.0 to 1.0 (Trust factor)
    description: string;
}

export interface SkillBelief {
    skillId: string;
    proficiencyMean: number; // 0-100
    confidenceInterval: number; // +/- error margin (e.g. 5 means 85 +/- 5)
    lastUpdated: string;
    evidenceChain: SkillSignal[];
    trend: 'RISING' | 'STABLE' | 'DECAYING';
}

export const SOURCE_RELIABILITY: Record<SignalSourceType, number> = {
    'PROCTORED_EXAM': 0.95,
    'PROJECT_DELIVERY': 0.85,
    'CODE_REPOSITORY': 0.75,
    'PEER_REVIEW': 0.60,
    'SOCIAL_PROOF': 0.30,
    'SELF_ATTESTATION': 0.10
};
