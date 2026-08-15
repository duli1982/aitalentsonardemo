// Service Context - React Context for Dependency Injection
// Allows components to access services without direct imports

import React, { createContext, useContext, useMemo } from 'react';
import { ServiceRegistry, createServiceRegistry } from '../services/ServiceRegistry';

const ServiceContext = createContext<ServiceRegistry | null>(null);

interface ServiceProviderProps {
    children: React.ReactNode;
    registry?: ServiceRegistry; // Optional override for testing
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({
    children,
    registry
}) => {
    const services = useMemo(() => registry || createServiceRegistry(), [registry]);

    return (
        <ServiceContext.Provider value={services}>
            {children}
        </ServiceContext.Provider>
    );
};

// Hook to access the full service registry
export const useServices = (): ServiceRegistry => {
    const context = useContext(ServiceContext);
    if (!context) {
        throw new Error('useServices must be used within a ServiceProvider');
    }
    return context;
};

// Convenience hooks for individual services
export const usePulseService = () => useServices().pulse;
export const useInferenceEngine = () => useServices().inference;
export const useGraphEngine = () => useServices().graph;
export const useAgentGateway = () => useServices().agent;
export const useAuditService = () => useServices().audit;
export const useCareerPathService = () => useServices().career;
export const useForecastService = () => useServices().forecast;
export const useIngestionService = () => useServices().ingestion;
export const useOrgTwinService = () => useServices().orgTwin;
