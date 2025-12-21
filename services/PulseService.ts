import { PulseAlert, PulseTrigger } from '../types/pulse';
import { eventBus, EVENTS } from '../utils/EventBus';

type AgentEventSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AgentEventPayload {
    type: string;
    message: string;
    severity?: AgentEventSeverity | string;
    title?: string;
    metadata?: Record<string, any>;
}

export class PulseService {
    private alerts: PulseAlert[] = [];
    private triggers: PulseTrigger[] = [];
    private subscribers: Set<(alerts: PulseAlert[]) => void> = new Set();

    constructor() {
        this.initializeTriggers();
        this.seedInitialAlerts();
        this.setupEventListeners();
    }

    private initializeTriggers(): void {
        this.triggers = [
            {
                id: 'trig_1',
                name: 'High Performer Flight Risk',
                condition: 'Graph Centrality Drop > 15%',
                frequency: 'REALTIME',
                isEnabled: true
            },
            {
                id: 'trig_2',
                name: 'Competitor Hiring Spree',
                condition: 'Competitor Job Posts > 20% Increase',
                frequency: 'DAILY',
                isEnabled: true
            },
            {
                id: 'trig_3',
                name: 'Pipeline Stall Detection',
                condition: 'No stage movement > 7 days',
                frequency: 'REALTIME',
                isEnabled: true
            }
        ];
    }

    private seedInitialAlerts(): void {
        this.alerts = [
            {
                id: 'alert_1',
                type: 'ATTRITION_RISK',
                severity: 'CRITICAL',
                title: 'High Flight Risk Detected',
                message: 'Michael Chen (Senior Data Scientist) has shown a 22% drop in internal graph connectivity this week.',
                timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                entityId: 'c1',
                isRead: false
            },
            {
                id: 'alert_2',
                type: 'MARKET_SIGNAL',
                severity: 'OPPORTUNITY',
                title: 'New Talent Pool Available',
                message: 'Competitor "BioTech X" announced a merger. 15 Senior QA specialists may be entering the market.',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
                isRead: false
            }
        ];
    }

    // Dynamic event listeners - alerts derived from real system events
    private setupEventListeners(): void {
        // Listen for candidate stage changes
        eventBus.on(EVENTS.CANDIDATE_STAGED, (data: { candidateName: string; stage: string }) => {
            if (data.stage === 'Offer') {
                this.createAlert({
                    type: 'INTERNAL_MOBILITY',
                    severity: 'INFO',
                    title: 'Offer Extended',
                    message: `${data.candidateName} has moved to Offer stage. Prepare compensation package.`
                });
            }
        });

        // Listen for hiring events
        eventBus.on(EVENTS.CANDIDATE_HIRED, (data: { candidateName: string; role: string }) => {
            this.createAlert({
                type: 'INTERNAL_MOBILITY',
                severity: 'OPPORTUNITY',
                title: 'New Hire!',
                message: `${data.candidateName} has been hired as ${data.role}. Onboarding starts soon.`
            });
        });

        // Listen for graph centrality changes (simulated)
        eventBus.on(EVENTS.GRAPH_CENTRALITY_CHANGED, (data: { nodeId: string; name: string; change: number }) => {
            if (data.change < -15) {
                this.createAlert({
                    type: 'ATTRITION_RISK',
                    severity: 'CRITICAL',
                    title: 'Network Isolation Detected',
                    message: `${data.name}'s graph centrality dropped ${Math.abs(data.change)}%. Potential flight risk.`,
                    entityId: data.nodeId
                });
            }
        });

        // Listen for job fill events
        eventBus.on(EVENTS.JOB_FILLED, (data: { jobTitle: string }) => {
            this.createAlert({
                type: 'INTERNAL_MOBILITY',
                severity: 'INFO',
                title: 'Position Filled',
                message: `${data.jobTitle} has been filled. Updating capacity models.`
            });
        });
    }

    private createAlert(partial: Omit<PulseAlert, 'id' | 'timestamp' | 'isRead'>): void {
        const alert: PulseAlert = {
            id: `alert_${Date.now()}`,
            timestamp: new Date().toISOString(),
            isRead: false,
            ...partial
        };

        this.alerts.unshift(alert);
        this.notifySubscribers();

        // Also emit via EventBus for other listeners
        eventBus.emit(EVENTS.PULSE_ALERT, alert);
    }

    /**
     * Backwards-compatible helper for agents/services that emit "events"
     * into the Pulse feed. This maps agent-style payloads onto PulseAlert.
     */
    public addEvent(payload: AgentEventPayload): void {
        const severity = String(payload.severity || 'info').toLowerCase();

        const mappedSeverity: PulseAlert['severity'] =
            severity === 'success' ? 'OPPORTUNITY'
                : severity === 'warning' ? 'WARNING'
                    : severity === 'error' ? 'CRITICAL'
                        : 'INFO';

        const agentType = payload.metadata?.agentType;
        const title = payload.title || (agentType ? `${agentType} Agent` : 'Agent Update');
        const entityId = payload.metadata?.candidateId || payload.metadata?.jobId;

        this.createAlert({
            type: 'INTERNAL_MOBILITY',
            severity: mappedSeverity,
            title,
            message: payload.message,
            entityId
        });
    }

    // Subscribe to alert updates
    public subscribe(callback: (alerts: PulseAlert[]) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    private notifySubscribers(): void {
        this.subscribers.forEach(cb => cb([...this.alerts]));
    }

    public getAlerts(): PulseAlert[] {
        return [...this.alerts];
    }

    public getUnreadCount(): number {
        return this.alerts.filter(a => !a.isRead).length;
    }

    public markAsRead(id: string): void {
        const alert = this.alerts.find(a => a.id === id);
        if (alert) {
            alert.isRead = true;
            this.notifySubscribers();
        }
    }

    public markAllAsRead(): void {
        this.alerts.forEach(a => a.isRead = true);
        this.notifySubscribers();
    }

    public getTriggers(): PulseTrigger[] {
        return [...this.triggers];
    }

    public toggleTrigger(id: string): void {
        const trigger = this.triggers.find(t => t.id === id);
        if (trigger) {
            trigger.isEnabled = !trigger.isEnabled;
        }
    }

    // Simulate a push notification (for demo)
    public simulateRealTimeAlert(): void {
        this.createAlert({
            type: 'MARKET_SIGNAL',
            severity: 'WARNING',
            title: 'Supply Shortage Detected',
            message: 'ML Engineer supply in Dublin market dropped 12% this quarter. Consider remote hiring.'
        });
    }
}

export const pulseService = new PulseService();
