// EventBus - Central event dispatcher for decoupled communication
// Enables reactive data flow between services

type EventCallback<T = any> = (data: T) => void;

interface EventSubscription {
    unsubscribe: () => void;
}

class EventBusService {
    private listeners: Map<string, Set<EventCallback>> = new Map();

    // Subscribe to an event
    on<T>(event: string, callback: EventCallback<T>): EventSubscription {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        return {
            unsubscribe: () => {
                this.listeners.get(event)?.delete(callback);
            }
        };
    }

    // Subscribe once
    once<T>(event: string, callback: EventCallback<T>): void {
        const wrapper: EventCallback<T> = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    // Unsubscribe
    off<T>(event: string, callback: EventCallback<T>): void {
        this.listeners.get(event)?.delete(callback);
    }

    // Emit an event
    emit<T>(event: string, data?: T): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`[EventBus] Error in ${event} handler:`, e);
                }
            });
        }
    }

    // Clear all listeners for an event
    clear(event?: string): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Event types for type safety
export const EVENTS = {
    // Graph Events
    GRAPH_NODE_ADDED: 'graph:node:added',
    GRAPH_NODE_REMOVED: 'graph:node:removed',
    GRAPH_EDGE_ADDED: 'graph:edge:added',
    GRAPH_CENTRALITY_CHANGED: 'graph:centrality:changed',

    // Candidate Events
    CANDIDATE_HIRED: 'candidate:hired',
    CANDIDATE_REJECTED: 'candidate:rejected',
    CANDIDATE_STAGED: 'candidate:staged',
    CANDIDATE_UPDATED: 'candidate:updated',

    // Job Events
    JOB_CREATED: 'job:created',
    JOB_FILLED: 'job:filled',
    JOB_CLOSED: 'job:closed',

    // Pulse Events
    PULSE_ALERT: 'pulse:alert',
    PULSE_NAVIGATE: 'pulse:navigate',

    // System Events
    DATA_SYNCED: 'system:data:synced',
    APP_DEGRADED: 'system:degraded',

    // Background Jobs / Agents
    BACKGROUND_JOBS_CHANGED: 'background:jobs:changed',
    BACKGROUND_JOB_RESULT: 'background:job:result',

    // Agent proposals
    PROPOSED_ACTIONS_CHANGED: 'agent:proposals:changed',

    // Intake Call events
    INTAKE_CALL_STARTED: 'intake:call:started',
    INTAKE_CALL_ENDED: 'intake:call:ended',
    INTAKE_SCORECARD_READY: 'intake:scorecard:ready',
    INTAKE_SCORECARD_APPROVED: 'intake:scorecard:approved',
} as const;

export type EventType = typeof EVENTS[keyof typeof EVENTS];

// Singleton export
export const eventBus = new EventBusService();
