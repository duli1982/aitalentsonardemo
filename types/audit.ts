export interface ComplianceRule {
    id: string;
    region: string; // "EU", "US", "Global"
    category: 'DATA_PRIVACY' | 'FAIRNESS' | 'RETENTION' | 'AI_TRANSPARENCY';
    description: string;
    isEnabled: boolean;
    lastAudited: string;
}

export interface DecisionFactor {
    factor: string; // "Skills Match"
    weight: number; // 0.7
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface DecisionReceipt {
    decisionId: string;
    timestamp: string;
    context: string; // "Shortlisting for Job X"
    outcome: string; // "Ranked #2"
    factors: DecisionFactor[];
    explanation: string; // Natural language
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    actor: string; // "User: Alice" or "Agent: HiringBot"
    action: string;
    details: string;
    complianceChecksPassed: boolean;
}
