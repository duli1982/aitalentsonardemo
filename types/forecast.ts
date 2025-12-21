export type ProjectType =
    // Pharma / manufacturing style
    | 'CLINICAL_HUB'
    | 'MFG_EXPANSION'
    | 'R_AND_D_CENTER'
    // Staffing / Randstad style
    | 'CLIENT_RAMP'
    | 'SEASONAL_SPIKE'
    | 'COMPLIANCE_CHANGE';

export interface ForecastScenario {
    id: string;
    name: string;
    projectType: ProjectType;
    region: string;
    launchDate: string; // ISO Date
    timeframeMonths: number;
    // Staffing extensions (optional)
    clientName?: string;
    targetHires?: number;
    primaryRole?: string;
}

export interface RoleDemand {
    roleTitle: string;
    count: number;
    timelineQ: string; // e.g., "Q1 2026"
    criticality: 'HIGH' | 'MEDIUM' | 'LOW';
    skillsRequired: string[];
    rationale: string;
}

export interface ForecastResult {
    scenarioId: string;
    totalHeadcount: number;
    demands: RoleDemand[];
    marketInsights: string[];
    risks?: AttritionRisk[];
}

export interface AttritionRisk {
    teamId: string;
    role: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    impact: string;
    mitigation: string;
}
