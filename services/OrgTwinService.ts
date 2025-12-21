import { ORG_TREE } from '../data/orgStructure';
import { ORG_TWIN_TEMPLATES, STAFFING_ORG_TREE } from '../data/orgTwinTemplates';
import type { OrgTwinTemplateId, OrgTwinScenario, OrgTwinTemplate } from '../data/orgTwinTemplates';
import type { Candidate, Job } from '../types';
import { OrgUnit, CapabilityMetric, ScenarioResult } from '../types/org';

export class OrgTwinService {

    public listTemplates(): OrgTwinTemplate[] {
        return ORG_TWIN_TEMPLATES.map((t) => ({ ...t, orgTree: this.getOrgTree(t.id) }));
    }

    public getTemplate(templateId: OrgTwinTemplateId): OrgTwinTemplate {
        const meta = ORG_TWIN_TEMPLATES.find((t) => t.id === templateId) ?? ORG_TWIN_TEMPLATES[0];
        return { ...meta, orgTree: this.getOrgTree(meta.id) } as OrgTwinTemplate;
    }

    public getOrgTree(templateId: OrgTwinTemplateId = 'pharma'): OrgUnit {
        return templateId === 'staffing' ? STAFFING_ORG_TREE : ORG_TREE;
    }

    public getScenarios(templateId: OrgTwinTemplateId): OrgTwinScenario[] {
        return this.getTemplate(templateId).scenarios;
    }

    private findOrgUnit(root: OrgUnit, unitId: string): OrgUnit | null {
        if (root.id === unitId) return root;
        for (const child of root.children ?? []) {
            const found = this.findOrgUnit(child, unitId);
            if (found) return found;
        }
        return null;
    }

    private collectLocations(root: OrgUnit): string[] {
        const locations = new Set<string>();
        const walk = (node: OrgUnit) => {
            if (node.location) locations.add(node.location);
            for (const child of node.children ?? []) walk(child);
        };
        walk(root);
        return Array.from(locations);
    }

    // Mocking the analysis engine - in a real app this would aggregate Graph Nodes
    public analyzeCapabilities(
        templateId: OrgTwinTemplateId,
        unitId: string,
        context?: { candidates?: Candidate[]; jobs?: Job[] }
    ): CapabilityMetric[] {
        const root = this.getOrgTree(templateId);
        const unit = this.findOrgUnit(root, unitId);
        const candidates = context?.candidates ?? [];

        if (unit && candidates.length > 0) {
            const locationHints = this.collectLocations(unit).map((l) => l.toLowerCase());
            const matchingCandidates = candidates.filter((c) => {
                const loc = (c.location ?? '').toLowerCase();
                return locationHints.some((hint) => hint.length > 2 && loc.includes(hint));
            });

            if (matchingCandidates.length > 0) {
                const skillStats = new Map<
                    string,
                    { totalProficiency: number; count: number; expertCount: number }
                >();

                for (const candidate of matchingCandidates) {
                    const verified = candidate.passport?.verifiedSkills ?? [];
                    for (const skillName of candidate.skills ?? []) {
                        const verifiedSkill = verified.find((s) => s.skillName === skillName);
                        const proficiency = verifiedSkill?.proficiencyLevel ?? 3;
                        const prev = skillStats.get(skillName) ?? { totalProficiency: 0, count: 0, expertCount: 0 };
                        skillStats.set(skillName, {
                            totalProficiency: prev.totalProficiency + proficiency,
                            count: prev.count + 1,
                            expertCount: prev.expertCount + (proficiency >= 4 ? 1 : 0)
                        });
                    }
                }

                const metrics = Array.from(skillStats.entries())
                    .map(([skillName, stat]) => {
                        const avgProficiency = stat.totalProficiency / Math.max(1, stat.count);
                        const benchStrength: CapabilityMetric['benchStrength'] =
                            avgProficiency >= 4 || stat.expertCount >= 5 ? 'HIGH' :
                                avgProficiency >= 3 || stat.expertCount >= 2 ? 'MEDIUM' : 'LOW';
                        const riskFactor: CapabilityMetric['riskFactor'] =
                            stat.expertCount === 1 ? 'SINGLE_POINT_OF_FAILURE' :
                                benchStrength === 'LOW' ? 'ATTRITION_RISK' : 'NONE';

                        return {
                            skillId: `skill_${skillName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                            skillName,
                            avgProficiency: Math.round(avgProficiency * 10) / 10,
                            expertCount: stat.expertCount,
                            benchStrength,
                            riskFactor
                        } satisfies CapabilityMetric;
                    })
                    .sort((a, b) => (b.expertCount - a.expertCount) || (b.avgProficiency - a.avgProficiency))
                    .slice(0, 6);

                if (metrics.length > 0) return metrics;
            }
        }

        // --- Fallback mock metrics (keeps the UI non-empty) ---
        // Return specific metrics based on the unit to demonstrate the scenario

        if (unitId.includes('darmstadt')) {
            return [
                { skillId: 'skill_upstream', skillName: 'Upstream Processing', avgProficiency: 4.2, expertCount: 8, benchStrength: 'HIGH', riskFactor: 'NONE' },
                { skillId: 'skill_downstream', skillName: 'Downstream Processing', avgProficiency: 3.9, expertCount: 5, benchStrength: 'MEDIUM', riskFactor: 'NONE' },
                { skillId: 'skill_gmp', skillName: 'GMP Documentation', avgProficiency: 4.5, expertCount: 20, benchStrength: 'HIGH', riskFactor: 'NONE' },
            ];
        }

        if (unitId.includes('cork')) {
            return [
                { skillId: 'skill_upstream', skillName: 'Upstream Processing', avgProficiency: 0, expertCount: 0, benchStrength: 'LOW', riskFactor: 'ATTRITION_RISK' },
                { skillId: 'skill_packaging', skillName: 'Solid Dose Packaging', avgProficiency: 4.8, expertCount: 15, benchStrength: 'HIGH', riskFactor: 'NONE' },
            ];
        }

        if (templateId === 'staffing') {
            if (unitId.includes('budapest')) {
                return [
                    { skillId: 'skill_sourcing', skillName: 'Candidate Sourcing', avgProficiency: 4.1, expertCount: 6, benchStrength: 'HIGH', riskFactor: 'NONE' },
                    { skillId: 'skill_screening', skillName: 'Structured Screening', avgProficiency: 3.5, expertCount: 2, benchStrength: 'MEDIUM', riskFactor: 'NONE' },
                    { skillId: 'skill_client_mgmt', skillName: 'Client Management', avgProficiency: 3.9, expertCount: 3, benchStrength: 'MEDIUM', riskFactor: 'NONE' },
                ];
            }

            if (unitId.includes('debrecen')) {
                return [
                    { skillId: 'skill_contact', skillName: 'Customer Support', avgProficiency: 3.2, expertCount: 1, benchStrength: 'MEDIUM', riskFactor: 'SINGLE_POINT_OF_FAILURE' },
                    { skillId: 'skill_marketing', skillName: 'Marketing & Sales', avgProficiency: 2.8, expertCount: 0, benchStrength: 'LOW', riskFactor: 'ATTRITION_RISK' },
                ];
            }
        }

        // Default / Global
        return [
            { skillId: 'skill_data_science', skillName: 'Data Science (Python)', avgProficiency: 2.1, expertCount: 1, benchStrength: 'LOW', riskFactor: 'SINGLE_POINT_OF_FAILURE' }
        ];
    }

    public runScenarioSimulation(templateId: OrgTwinTemplateId, scenarioType: string): ScenarioResult[] {
        if (scenarioType === 'IRELAND_EXPANSION') {
            return [
                {
                    gapName: 'Biologics Critical Mass',
                    missingHeadcount: 12,
                    missingSkills: ['Downstream Processing', 'Chromatography', 'Bioreactor Operation'],
                    suggestedAction: 'Action Required: Initiate internal mobility from Darmstadt (3 candidates identified) and open external requisitions immediately.',
                    impactLevel: 'CRITICAL',
                    timeFrame: '18 Months'
                },
                {
                    gapName: 'Process Validation Leads',
                    missingHeadcount: 2,
                    missingSkills: ['Process Validation', 'FDA Audit Prep'],
                    suggestedAction: 'Upskill existing Quality Engineers at Cork site using Virtual Reality Twin training.',
                    impactLevel: 'HIGH',
                    timeFrame: '12 Months'
                }
            ];
        }

        if (scenarioType === 'APAC_SCALE') {
            return [
                {
                    gapName: 'Regional Compliance Expertise',
                    missingHeadcount: 8,
                    missingSkills: ['NMPA Regulations', 'Japanese PMDA', 'Mandarin (Business)'],
                    suggestedAction: 'Partner with local universities and regulatory consultancies for rapid capability build.',
                    impactLevel: 'HIGH',
                    timeFrame: '24 Months'
                }
            ];
        }

        if (scenarioType === 'DIGITAL_TRANSFORM') {
            return [
                {
                    gapName: 'Digital Manufacturing Skills',
                    missingHeadcount: 15,
                    missingSkills: ['Industrial IoT', 'Digital Twin', 'MES Systems', 'Python/AI'],
                    suggestedAction: 'Launch internal Digital Academy program and consider acqui-hire from tech startups.',
                    impactLevel: 'CRITICAL',
                    timeFrame: '12 Months'
                }
            ];
        }

        if (templateId === 'staffing') {
            if (scenarioType === 'CLIENT_RAMP') {
                return [
                    {
                        gapName: 'Recruiter Capacity (Ramp)',
                        missingHeadcount: 3,
                        missingSkills: ['High-volume Screening', 'Candidate Outreach', 'Client SLA Management'],
                        suggestedAction: 'Allocate 2 recruiters from Benelux desk and activate Automated Screening Agent for first-pass triage.',
                        impactLevel: 'HIGH',
                        timeFrame: '2 Weeks'
                    },
                    {
                        gapName: 'Interview Scheduling Throughput',
                        missingHeadcount: 2,
                        missingSkills: ['Calendar Coordination', 'Stakeholder Comms'],
                        suggestedAction: 'Enable Scheduling Agent auto-reschedule workflow and pre-book interview blocks with hiring teams.',
                        impactLevel: 'MEDIUM',
                        timeFrame: '2 Weeks'
                    }
                ];
            }

            if (scenarioType === 'SEASONAL_SPIKE') {
                return [
                    {
                        gapName: 'Screening Bottleneck Risk',
                        missingHeadcount: 6,
                        missingSkills: ['Structured Interviews', 'Assessment Review', 'ATS Workflow'],
                        suggestedAction: 'Add weekend screening shifts and route borderline candidates to “New” with AI notes for rapid review.',
                        impactLevel: 'CRITICAL',
                        timeFrame: '30 Days'
                    }
                ];
            }

            if (scenarioType === 'COMPLIANCE_CHANGE') {
                return [
                    {
                        gapName: 'Document Re-verification Backlog',
                        missingHeadcount: 4,
                        missingSkills: ['Compliance Review', 'Document Validation'],
                        suggestedAction: 'Prioritize candidates in interview pipeline; trigger bulk document reminders and validate before offer stage.',
                        impactLevel: 'HIGH',
                        timeFrame: '14 Days'
                    }
                ];
            }
        }

        return [];
    }
}

export const orgTwinService = new OrgTwinService();
