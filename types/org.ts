export type OrgUnitType = 'GLOBAL' | 'BU' | 'REGION' | 'SITE' | 'DEPARTMENT' | 'TEAM';

export interface OrgUnit {
    id: string;
    name: string;
    type: OrgUnitType;
    parentId?: string;
    headcount: number;
    location?: string;
    children?: OrgUnit[];
}

export interface CapabilityMetric {
    skillId: string;
    skillName: string;
    avgProficiency: number; // 0-5
    expertCount: number; // Level 4+
    benchStrength: 'LOW' | 'MEDIUM' | 'HIGH';
    riskFactor: 'NONE' | 'SINGLE_POINT_OF_FAILURE' | 'ATTRITION_RISK';
}

export interface ScenarioResult {
    gapName: string;
    missingHeadcount: number;
    missingSkills: string[];
    suggestedAction: string;
    impactLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    timeFrame: string;
}
