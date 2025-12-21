export type AgentRole = 'RECRUITER' | 'HIRING_MANAGER' | 'CANDIDATE';

export interface AgentContext {
    role: AgentRole;
    userId: string; // "hm_1", "cand_1"
    permissions: string[];
}

export interface AgentRequest {
    intent: 'FIND_CANDIDATES' | 'FIND_CAREER_PATH' | 'CHECK_COMPLIANCE' | 'GENERAL_QUERY';
    query: string; // Natural language query
    parameters?: any;
    context: AgentContext;
}

export interface AgentResponse {
    success: boolean;
    message: string; // Conversational response
    data?: any; // Structured payload for the calling agent
    actionTaken?: string;
}
