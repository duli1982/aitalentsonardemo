import { ProjectType, ForecastScenario, ForecastResult, RoleDemand, AttritionRisk } from '../types/forecast';

export class DemandForecastingService {

    public runForecast(scenario: ForecastScenario): ForecastResult {
        // 1. Core Logic based on Project Type
        let demands: RoleDemand[] = [];
        let marketInsights: string[] = [];

        if (scenario.projectType === 'CLINICAL_HUB') {
            demands = this.getClinicalHubPattern(scenario);
            marketInsights = [
                `High demand for Clinical Project Managers in ${scenario.region} due to competitor expansion.`,
                'Regulatory Affairs talent pool is tight; expect 4-6 month hiring cycle.'
            ];
        } else if (scenario.projectType === 'MFG_EXPANSION') {
            demands = this.getManufacturingExpansionPattern(scenario);
            marketInsights = [
                `Qualified manufacturing talent is scarce in ${scenario.region}; expect longer lead times for senior roles.`,
                'Shift coverage is a hidden constraint: factor in weekend/night scheduling early.'
            ];
        } else if (scenario.projectType === 'R_AND_D_CENTER') {
            demands = this.getRnDCenterPattern(scenario);
            marketInsights = [
                `Competition for AI/Data roles in ${scenario.region} is intense; pay bands may need adjustment.`,
                'Consider hybrid/remote to expand reachable talent pool.'
            ];
        } else if (scenario.projectType === 'CLIENT_RAMP') {
            demands = this.getStaffingClientRampPattern(scenario);
            marketInsights = [
                `Client ramp risk: fill-rate pressure spikes quickly in ${scenario.region}.`,
                'Automated screening + fast scheduling reduces time-to-submit during high-volume ramps.'
            ];
        } else if (scenario.projectType === 'SEASONAL_SPIKE') {
            demands = this.getStaffingSeasonalSpikePattern(scenario);
            marketInsights = [
                `Seasonal spike expected in ${scenario.region}; pre-build pipeline before peak weeks.`,
                'Ensure compliance docs and availability checks are automated to prevent drop-off.'
            ];
        } else if (scenario.projectType === 'COMPLIANCE_CHANGE') {
            demands = this.getStaffingComplianceChangePattern(scenario);
            marketInsights = [
                'Compliance changes disproportionately impact high-volume roles; throughput depends on document verification capacity.',
                'Proactively message candidates about required documents to reduce churn.'
            ];
        }

        const risks = this.detectAttritionRisk(scenario.region);

        return {
            scenarioId: scenario.id,
            totalHeadcount: demands.reduce((acc, curr) => acc + curr.count, 0),
            demands,
            marketInsights,
            risks
        };
    }

    private detectAttritionRisk(region: string): AttritionRisk[] {
        // Mock logic: "High attrition predicted in a specific team"
        if (region === 'Spain' || region === 'Germany') {
            return [
                {
                    teamId: 'team_regulatory_eu',
                    role: 'Senior Regulatory Affairs',
                    riskLevel: 'HIGH',
                    impact: 'Potential delay in submission timelines if senior staff leave.',
                    mitigation: 'Initiate retention bonuses and succession planning immediately.'
                }
            ];
        }
        return [];
    }

    private getClinicalHubPattern(scenario: ForecastScenario): RoleDemand[] {
        // "Merck KGaA planning a new clinical trial hub" pattern
        // The prompt specifies: 8 CTAs, 4 CPMs, 3 RA, 3 Data Mgrs, 2 Biostats

        // Simplistic timeline distribution relative to start
        // Q1: Leadership + Senior PMs
        // Q2: Core CTAs + Regulatory
        // Q3: Data + Biostats

        return [
            {
                roleTitle: 'Clinical Project Manager',
                count: 4,
                timelineQ: 'Phase 1 (Month 1-3)',
                criticality: 'HIGH',
                skillsRequired: ['Clinical Trial Management', 'Budgeting', 'Vendor Management'],
                rationale: 'Core leadership for trial setup.'
            },
            {
                roleTitle: 'Regulatory Affairs Specialist',
                count: 3,
                timelineQ: 'Phase 1 (Month 1-3)',
                criticality: 'HIGH',
                skillsRequired: ['EMA Regulations', 'Submission Strategy'],
                rationale: 'Required for initial site approvals.'
            },
            {
                roleTitle: 'Clinical Trial Associate',
                count: 8,
                timelineQ: 'Phase 2 (Month 4-6)',
                criticality: 'MEDIUM',
                skillsRequired: ['TMF Maintenance', 'Site Monitoring'],
                rationale: 'High volume support for active trials.'
            },
            {
                roleTitle: 'Data Manager',
                count: 3,
                timelineQ: 'Phase 3 (Month 6-9)',
                criticality: 'MEDIUM',
                skillsRequired: ['EDC Systems', 'Data Validation'],
                rationale: 'Needed once patient data flow begins.'
            },
            {
                roleTitle: 'Biostatistician',
                count: 2,
                timelineQ: 'Phase 3 (Month 6-9)',
                criticality: 'MEDIUM',
                skillsRequired: ['SAS Programming', 'Statistical Analysis Plan'],
                rationale: 'Analysis of initial safety data.'
            }
        ];
    }

    private getManufacturingExpansionPattern(scenario: ForecastScenario): RoleDemand[] {
        return [
            {
                roleTitle: 'Manufacturing Supervisor',
                count: 3,
                timelineQ: 'Phase 1 (Month 1-3)',
                criticality: 'HIGH',
                skillsRequired: ['Shift Leadership', 'Lean Manufacturing', 'Safety'],
                rationale: 'Establish shift coverage and standard work before scale-up.'
            },
            {
                roleTitle: 'Process Engineer',
                count: 5,
                timelineQ: 'Phase 2 (Month 4-6)',
                criticality: 'HIGH',
                skillsRequired: ['Process Optimization', 'Root Cause Analysis', 'CAPA'],
                rationale: 'Increase yield and stabilize processes during ramp.'
            },
            {
                roleTitle: 'Quality Engineer',
                count: 4,
                timelineQ: 'Phase 2 (Month 4-6)',
                criticality: 'MEDIUM',
                skillsRequired: ['GMP', 'Deviation Management', 'SOPs'],
                rationale: 'Compliance and quality system capacity must scale with throughput.'
            },
            {
                roleTitle: 'Maintenance Technician',
                count: 6,
                timelineQ: 'Phase 3 (Month 6-9)',
                criticality: 'MEDIUM',
                skillsRequired: ['Preventive Maintenance', 'Troubleshooting', 'Reliability'],
                rationale: 'Equipment reliability becomes a bottleneck after volume increases.'
            }
        ];
    }

    private getRnDCenterPattern(scenario: ForecastScenario): RoleDemand[] {
        return [
            {
                roleTitle: 'Principal Scientist',
                count: 2,
                timelineQ: 'Phase 1 (Month 1-3)',
                criticality: 'HIGH',
                skillsRequired: ['Research Leadership', 'Experimental Design', 'Stakeholder Management'],
                rationale: 'Define research roadmap and validate feasibility.'
            },
            {
                roleTitle: 'Data Scientist',
                count: 4,
                timelineQ: 'Phase 2 (Month 4-6)',
                criticality: 'MEDIUM',
                skillsRequired: ['Python', 'Machine Learning', 'Statistics'],
                rationale: 'Build early models and experiment pipeline.'
            },
            {
                roleTitle: 'Research Engineer',
                count: 3,
                timelineQ: 'Phase 2 (Month 4-6)',
                criticality: 'MEDIUM',
                skillsRequired: ['Prototyping', 'Cloud', 'MLOps'],
                rationale: 'Turn experiments into usable internal tools.'
            }
        ];
    }

    private getStaffingClientRampPattern(scenario: ForecastScenario): RoleDemand[] {
        const target = Math.max(10, scenario.targetHires ?? 50);
        const primaryRole = scenario.primaryRole?.trim() || 'Customer Support Agent';
        const leadCount = Math.max(1, Math.round(target * 0.08));
        const qaCount = Math.max(1, Math.round(target * 0.06));
        const coreCount = Math.max(1, target - leadCount - qaCount);

        return [
            {
                roleTitle: primaryRole,
                count: coreCount,
                timelineQ: 'Wave 1 (Week 1-2)',
                criticality: 'HIGH',
                skillsRequired: ['Communication', 'Shift Availability', 'Basic Tools'],
                rationale: `Client ramp requires fast coverage; majority of hires land in the first two weeks.`
            },
            {
                roleTitle: `${primaryRole} Team Lead`,
                count: leadCount,
                timelineQ: 'Wave 1 (Week 1-2)',
                criticality: 'HIGH',
                skillsRequired: ['Team Leadership', 'Coaching', 'Escalation Handling'],
                rationale: 'Team leads reduce early attrition and accelerate onboarding.'
            },
            {
                roleTitle: 'Quality & Compliance Checker',
                count: qaCount,
                timelineQ: 'Wave 2 (Week 3-4)',
                criticality: 'MEDIUM',
                skillsRequired: ['Documentation', 'Attention to Detail', 'Process Adherence'],
                rationale: 'QA capacity stabilizes performance after initial ramp.'
            }
        ];
    }

    private getStaffingSeasonalSpikePattern(scenario: ForecastScenario): RoleDemand[] {
        const target = Math.max(25, scenario.targetHires ?? 200);
        const primaryRole = scenario.primaryRole?.trim() || 'Warehouse Associate';
        const forkliftCount = Math.max(5, Math.round(target * 0.18));
        const pickerCount = Math.max(10, target - forkliftCount);

        return [
            {
                roleTitle: primaryRole,
                count: pickerCount,
                timelineQ: 'Wave 1 (Month 1)',
                criticality: 'HIGH',
                skillsRequired: ['Physical Work', 'Shift Work', 'Reliability'],
                rationale: 'Seasonal peak requires rapid bulk hires before the first peak week.'
            },
            {
                roleTitle: 'Forklift Operator',
                count: forkliftCount,
                timelineQ: 'Wave 1 (Month 1)',
                criticality: 'HIGH',
                skillsRequired: ['Forklift License', 'Safety', 'Warehouse Ops'],
                rationale: 'Specialized roles drive throughput; delays create backlog and SLA penalties.'
            }
        ];
    }

    private getStaffingComplianceChangePattern(scenario: ForecastScenario): RoleDemand[] {
        const target = Math.max(10, scenario.targetHires ?? 40);
        const specialistCount = Math.max(2, Math.round(target * 0.2));
        const coordinatorCount = Math.max(2, Math.round(target * 0.2));
        const remaining = Math.max(1, target - specialistCount - coordinatorCount);

        return [
            {
                roleTitle: 'Document Verification Specialist',
                count: specialistCount,
                timelineQ: 'Wave 1 (Week 1-2)',
                criticality: 'HIGH',
                skillsRequired: ['Compliance Review', 'Document Validation', 'Attention to Detail'],
                rationale: 'Compliance changes require re-verification to keep pipeline moving.'
            },
            {
                roleTitle: 'Candidate Care Coordinator',
                count: coordinatorCount,
                timelineQ: 'Wave 1 (Week 1-2)',
                criticality: 'MEDIUM',
                skillsRequired: ['Candidate Communication', 'Follow-ups', 'Process Tracking'],
                rationale: 'High candidate drop-off is common; coordinators reduce churn.'
            },
            {
                roleTitle: 'Generalist Recruiter',
                count: remaining,
                timelineQ: 'Wave 2 (Week 3-4)',
                criticality: 'MEDIUM',
                skillsRequired: ['Sourcing', 'Screening', 'ATS Workflow'],
                rationale: 'Additional recruiter capacity offsets slower throughput caused by compliance friction.'
            }
        ];
    }
}

export const demandForecastingService = new DemandForecastingService();
