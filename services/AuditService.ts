import { AuditLogEntry, ComplianceRule, DecisionReceipt } from '../types/audit';

export class AuditService {
    private logs: AuditLogEntry[] = [];
    private rules: ComplianceRule[] = [
        {
            id: 'rule_gdpr_1',
            region: 'EU',
            category: 'DATA_PRIVACY',
            description: 'Enforce Candidate Anonymization in Initial Screen',
            isEnabled: true,
            lastAudited: '2025-10-01'
        },
        {
            id: 'rule_wc_de',
            region: 'Germany',
            category: 'FAIRNESS',
            description: 'Works Council Approval Required for External Hires',
            isEnabled: true,
            lastAudited: '2025-11-15'
        },
        {
            id: 'rule_ai_act',
            region: 'EU',
            category: 'AI_TRANSPARENCY',
            description: 'Provide Natural Language Explanation for Ranking > 50 candidates',
            isEnabled: true,
            lastAudited: '2025-12-01'
        }
    ];

    constructor() {
        // Seed mock logs
        this.logs.push({
            id: 'log_1',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            actor: 'System',
            action: 'Compliance Check',
            details: 'Verified GDPR retention policies for 145 candidates.',
            complianceChecksPassed: true
        });
        this.logs.push({
            id: 'log_2',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            actor: 'Hiring Manager Agent',
            action: 'Shortlist Generated',
            details: 'Shortlisted 5 candidates for Job #123. Fairness Guardrail Active.',
            complianceChecksPassed: true
        });
    }

    public getRules(): ComplianceRule[] {
        return this.rules;
    }

    public toggleRule(id: string): void {
        const rule = this.rules.find(r => r.id === id);
        if (rule) {
            rule.isEnabled = !rule.isEnabled;
            this.logAction('Admin', `Toggled Rule ${rule.id} to ${rule.isEnabled}`);
        }
    }

    public getLogs(): AuditLogEntry[] {
        return [...this.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    public logAction(actor: string, action: string, details: string = ''): void {
        this.logs.unshift({
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor,
            action,
            details,
            complianceChecksPassed: true
        });
    }

    public generateDecisionReceipt(candidateName: string, rank: number): DecisionReceipt {
        return {
            decisionId: `dec_${Date.now()}`,
            timestamp: new Date().toISOString(),
            context: `Ranking for Senior Data Scientist`,
            outcome: `Ranked #${rank}`,
            explanation: `Candidate ${candidateName} was prioritized based on a 95% Skill Match and strong internal performance history. No demographic factors influenced this decision.`,
            factors: [
                { factor: 'Skills Match', weight: 0.8, impact: 'POSITIVE' },
                { factor: 'Internal Mobility', weight: 0.4, impact: 'POSITIVE' },
                { factor: 'Location Match', weight: 0.2, impact: 'NEUTRAL' }
            ]
        };
    }
}

export const auditService = new AuditService();
