import { AgentRequest, AgentResponse } from '../types/agent';
import { graphEngine } from './GraphEngine';
import { AGENT_ROLES, ROLES } from '../types/ontology';
import { hasPermission, PERMISSIONS } from '../config/security';

export class AgentGateway {

    public async handleRequest(request: AgentRequest): Promise<AgentResponse> {
        // 1. Permission Check (PBAC)
        if (!this.checkPermissions(request)) {
            return {
                success: false,
                message: "Access Denied: You do not have permission to view this data."
            };
        }

        // 2. Intent Routing
        switch (request.intent) {
            case 'FIND_CANDIDATES':
                return this.handleFindCandidates(request);
            case 'FIND_CAREER_PATH':
                return this.handleFindCareerPath(request);
            default:
                return {
                    success: false,
                    message: "I'm sorry, I don't understand that request."
                };
        }
    }

    private checkPermissions(request: AgentRequest): boolean {
        // Map Agent Intent to Required Permission
        const intentPermissionMap: Record<string, string> = {
            'FIND_CANDIDATES': PERMISSIONS.VIEW_INTERNAL_CANDIDATES,
            'FIND_CAREER_PATH': PERMISSIONS.VIEW_JOB_DETAILS, // SImple mapping
        };

        const requiredPermission = intentPermissionMap[request.intent];

        // If no strict permission required, allow? Or deny?
        // Let's assume some intents are public, but these two are protected.
        if (requiredPermission) {
            return hasPermission(request.context.role, requiredPermission as any);
        }

        return true;
    }

    private handleFindCandidates(request: AgentRequest): AgentResponse {
        // Mocking the NLP extraction of "Internal people for Junior Production Lead"
        // In real life, an LLM would extract { role: 'Production Lead', source: 'Internal' }

        // We'll simulate a query to the Graph Engine
        const mockJobId = "job_process_lead"; // Implicitly found from query
        const matches = graphEngine.findTalentForRole(mockJobId);

        // Filter for "Internal" logic if requested (Mocking filtering)
        const internalMatches = matches.slice(0, 3);

        return {
            success: true,
            message: `I found ${internalMatches.length} internal candidates who could move into the ${ROLES.PRODUCTION_LEAD} role.`,
            data: internalMatches.map(m => ({
                id: m.candidateId,
                score: m.score,
                reason: m.explanation[0] // Brief reason
            }))
        };
    }

    private handleFindCareerPath(request: AgentRequest): AgentResponse {
        // Mocking "Show me internal roles where I can use my QC skills"

        const suggestions = [
            {
                role: ROLES.QA_LEAD,
                match: '90%',
                gap: 'None. Ready now.'
            },
            {
                role: ROLES.REGULATORY_SPECIALIST,
                match: '65%',
                gap: 'Needs certification in EU Regulations.'
            }
        ];

        return {
            success: true,
            message: "Based on your QC skills, here are 2 viable internal moves.",
            data: suggestions
        };
    }
}

export const agentGateway = new AgentGateway();
