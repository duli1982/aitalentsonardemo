export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'OPPORTUNITY';
export type AlertType = 'ATTRITION_RISK' | 'MARKET_SIGNAL' | 'COMPETITOR_MOVE' | 'INTERNAL_MOBILITY';

export interface PulseEntityRef {
    candidateId?: string;
    jobId?: string;
    stage?: string;
}

export interface PulseAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    timestamp: string;
    entityId?: string; // e.g., Candidate ID or Job ID
    entityRef?: PulseEntityRef;
    actionLink?: string; // Where does this take you?
    isRead: boolean;
}

export interface PulseTrigger {
    id: string;
    name: string;
    condition: string; // "Graph Centrality Drop > 15%"
    frequency: 'REALTIME' | 'DAILY';
    isEnabled: boolean;
}
