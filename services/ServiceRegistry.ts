// Service Registry - Central hub for all services
// Enables mock/real switching and dependency injection

import { pulseService, PulseService } from './PulseService';
import { inferenceEngine, InferenceEngine } from './InferenceEngine';
import { graphEngine, GraphEngine } from './GraphEngine';
import { agentGateway, AgentGateway } from './AgentGateway';
import { auditService, AuditService } from './AuditService';
import { careerPathService, CareerPathService } from './CareerPathService';
import { demandForecastingService, DemandForecastingService } from './DemandForecastingService';
import { ingestionService, IngestionService } from './IngestionService';
import { orgTwinService, OrgTwinService } from './OrgTwinService';

// Service interface definitions for type safety
export interface ServiceRegistry {
    pulse: PulseService;
    inference: InferenceEngine;
    graph: GraphEngine;
    agent: AgentGateway;
    audit: typeof auditService;
    career: CareerPathService;
    forecast: DemandForecastingService;
    ingestion: IngestionService;
    orgTwin: OrgTwinService;
}

// Default registry with current (mock) implementations
export const createMockRegistry = (): ServiceRegistry => ({
    pulse: pulseService,
    inference: inferenceEngine,
    graph: graphEngine,
    agent: agentGateway,
    audit: auditService,
    career: careerPathService,
    forecast: demandForecastingService,
    ingestion: ingestionService,
    orgTwin: orgTwinService,
});

// Future: Real implementations would be created here
export const createProductionRegistry = (): ServiceRegistry => {
    // In production, these would connect to real APIs
    // For now, return mock implementations
    console.log('[ServiceRegistry] Using PRODUCTION services');
    return createMockRegistry();
};

// Environment-based factory
export const createServiceRegistry = (): ServiceRegistry => {
    const env = import.meta.env.MODE || 'development';

    if (env === 'production') {
        return createProductionRegistry();
    }

    console.log('[ServiceRegistry] Using MOCK services');
    return createMockRegistry();
};

// Default singleton export for backward compatibility
export const services = createServiceRegistry();
