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

    private normalizeLocation(value: string): string[] {
        const normalized = value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\b(remote|hybrid|onsite|on-site)\b/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        const aliases: Record<string, string> = {
            deutschland: 'germany', magyarorszag: 'hungary', eire: 'ireland',
            schweiz: 'switzerland', suisse: 'switzerland', nederland: 'netherlands'
        };
        return normalized.split(/\s+/).filter((part) => part.length > 2).map((part) => aliases[part] ?? part);
    }

    public matchesUnit(unit: OrgUnit, record: Candidate | Job): boolean {
        const explicitUnitId = 'requiredSkills' in record
            ? record.companyContext?.orgUnitId
            : record.metadata?.orgUnitId;
        if (typeof explicitUnitId === 'string' && explicitUnitId.length > 0) {
            const descendantIds = new Set<string>();
            const walk = (node: OrgUnit) => {
                descendantIds.add(node.id);
                for (const child of node.children ?? []) walk(child);
            };
            walk(unit);
            return descendantIds.has(explicitUnitId);
        }

        const recordTokens = new Set(this.normalizeLocation(record.location ?? ''));
        if (!recordTokens.size) return false;
        const hintTokens = this.collectLocations(unit).flatMap((location) => this.normalizeLocation(location));
        return hintTokens.some((token) => recordTokens.has(token));
    }

    public candidatesForUnit(unit: OrgUnit, candidates: Candidate[]): Candidate[] {
        return candidates.filter((candidate) => this.matchesUnit(unit, candidate));
    }

    public jobsForUnit(unit: OrgUnit, jobs: Job[]): Job[] {
        return jobs.filter((job) => job.status === 'open' && this.matchesUnit(unit, job));
    }

    public analyzeCapabilities(
        templateId: OrgTwinTemplateId,
        unitId: string,
        context?: { candidates?: Candidate[]; jobs?: Job[] }
    ): CapabilityMetric[] {
        const root = this.getOrgTree(templateId);
        const unit = this.findOrgUnit(root, unitId);
        const candidates = context?.candidates ?? [];

        if (unit) {
            const matchingCandidates = this.candidatesForUnit(unit, candidates);
            const matchingJobs = this.jobsForUnit(unit, context?.jobs ?? []);

            if (matchingCandidates.length > 0 || matchingJobs.length > 0) {
                const skillStats = new Map<
                    string,
                    { displayName: string; totalProficiency: number; supplyCount: number; verifiedCount: number; expertCount: number; demandCount: number }
                >();

                for (const candidate of matchingCandidates) {
                    const verified = candidate.passport?.verifiedSkills ?? [];
                    for (const skillName of candidate.skills ?? []) {
                        const key = skillName.trim().toLowerCase();
                        const verifiedSkill = verified.find((s) => s.skillName.trim().toLowerCase() === key);
                        const prev = skillStats.get(key) ?? { displayName: skillName, totalProficiency: 0, supplyCount: 0, verifiedCount: 0, expertCount: 0, demandCount: 0 };
                        skillStats.set(key, {
                            ...prev,
                            totalProficiency: prev.totalProficiency + (verifiedSkill?.proficiencyLevel ?? 0),
                            supplyCount: prev.supplyCount + 1,
                            verifiedCount: prev.verifiedCount + (verifiedSkill ? 1 : 0),
                            expertCount: prev.expertCount + ((verifiedSkill?.proficiencyLevel ?? 0) >= 4 ? 1 : 0)
                        });
                    }
                }

                for (const job of matchingJobs) {
                    const required = Math.max(1, job.headcount ?? 1);
                    for (const skillName of job.requiredSkills ?? []) {
                        const key = skillName.trim().toLowerCase();
                        const prev = skillStats.get(key) ?? { displayName: skillName, totalProficiency: 0, supplyCount: 0, verifiedCount: 0, expertCount: 0, demandCount: 0 };
                        skillStats.set(key, { ...prev, demandCount: prev.demandCount + required });
                    }
                }

                const metrics = Array.from(skillStats.entries())
                    .map(([key, stat]) => {
                        const avgProficiency = stat.verifiedCount ? stat.totalProficiency / stat.verifiedCount : 0;
                        const benchStrength: CapabilityMetric['benchStrength'] =
                            stat.supplyCount >= Math.max(3, stat.demandCount) ? 'HIGH' :
                                stat.supplyCount >= Math.max(1, Math.ceil(stat.demandCount / 2)) ? 'MEDIUM' : 'LOW';
                        const riskFactor: CapabilityMetric['riskFactor'] =
                            stat.expertCount === 1 && stat.demandCount > 0 ? 'SINGLE_POINT_OF_FAILURE' :
                                benchStrength === 'LOW' ? 'ATTRITION_RISK' : 'NONE';

                        return {
                            skillId: `skill_${key.replace(/[^a-z0-9]+/g, '_')}`,
                            skillName: stat.displayName,
                            avgProficiency: Math.round(avgProficiency * 10) / 10,
                            expertCount: stat.expertCount,
                            supplyCount: stat.supplyCount,
                            verifiedCount: stat.verifiedCount,
                            demandCount: stat.demandCount,
                            benchStrength,
                            riskFactor
                        } satisfies CapabilityMetric;
                    })
                    .sort((a, b) => ((b.demandCount ?? 0) - (b.supplyCount ?? 0)) - ((a.demandCount ?? 0) - (a.supplyCount ?? 0)) || (b.supplyCount ?? 0) - (a.supplyCount ?? 0))
                    .slice(0, 12);

                if (metrics.length > 0) return metrics;
            }
        }
        return [];
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
