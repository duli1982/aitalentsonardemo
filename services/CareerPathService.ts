import { CareerPath, BuildVsBuyMetrics } from '../types/career';
import { ROLES } from '../types/ontology';

export class CareerPathService {

    public generatePath(currentRole: string, targetRole: string, domain: 'pharma' | 'staffing' = 'pharma'): CareerPath {
        if (domain === 'staffing') {
            return this.generateStaffingPath(currentRole, targetRole);
        }

        // Mock Logic: Generating "QC Analyst to Data Analyst" path

        // Strict check if possible, or fuzzy include for demo flexibility
        if (targetRole.includes(ROLES.DATA_ANALYST) && currentRole.includes('QC')) {
            return {
                id: 'path_qc_to_data',
                sourceRole: currentRole,
                targetRole: targetRole,
                totalDurationMonths: 18,
                feasibilityScore: 85,
                gapsToClose: ['Python', 'SQL', 'Data Modeling'],
                steps: [
                    {
                        type: 'TRAINING',
                        roleTitle: 'Foundational Data Skills',
                        durationMonths: 3,
                        requiredSkills: ['Python Basics', 'SQL Intro'],
                        description: 'Complete internal learning modules and earn badges.'
                    },
                    {
                        type: 'PROJECT',
                        roleTitle: ROLES.DATA_CHAMPION,
                        durationMonths: 6,
                        requiredSkills: ['Data Cleaning', 'Dashboarding'],
                        description: 'Dedicate 20% of time to analyzing QC batch data deviations.'
                    },
                    {
                        type: 'ROLE',
                        roleTitle: ROLES.JUNIOR_DATA_ANALYST,
                        durationMonths: 9,
                        requiredSkills: ['Predictive Modeling', 'ETL'],
                        description: 'Full transition to the Data Science team under mentorship.'
                    }
                ]
            };
        }

        // Generic fallback path
        return {
            id: 'path_generic',
            sourceRole: currentRole,
            targetRole: targetRole,
            totalDurationMonths: 24,
            feasibilityScore: 60,
            gapsToClose: ['Leadership', 'Strategic Planning'],
            steps: [
                {
                    type: 'ROLE',
                    roleTitle: `Senior ${currentRole} `,
                    durationMonths: 12,
                    requiredSkills: ['Mentorship'],
                    description: 'Gain seniority and lead small projects.'
                },
                {
                    type: 'ROLE',
                    roleTitle: targetRole,
                    durationMonths: 12,
                    requiredSkills: ['Strategy'],
                    description: 'Transition to target role.'
                }
            ]
        };
    }

    public analyzeBuildVsBuy(
        role: string,
        domain: 'pharma' | 'staffing' = 'pharma',
        options?: { urgency?: 1 | 2 | 3 | 4 | 5; targetHires?: number }
    ): BuildVsBuyMetrics {
        const urgency = options?.urgency ?? 3;
        const targetHires = Math.max(1, options?.targetHires ?? 1);

        if (domain === 'staffing') {
            const baseBuildTime = 2 + Math.max(0, urgency - 2); // 2-5 months
            const baseBuyTime = Math.max(1, 4 - urgency); // 3->2->1 months as urgency increases

            const buildCost = 3500 * targetHires + 1200 * urgency;
            const buyCost = 9000 * targetHires + 2500 * urgency;

            const buildRetention = Math.min(0.92, 0.75 + (0.04 * (5 - urgency))); // higher when not rushed
            const buyRetention = Math.max(0.55, 0.7 - (0.03 * urgency)); // lower under urgency

            const timePressure = urgency >= 4;
            const volumePressure = targetHires >= 50;

            const recommendation: BuildVsBuyMetrics['recommendation'] =
                timePressure && volumePressure ? 'MIXED' :
                    timePressure ? 'BUY' :
                        volumePressure ? 'MIXED' : 'BUILD';

            return {
                role,
                build: {
                    cost: Math.round(buildCost),
                    timeMonths: baseBuildTime,
                    retentionProb: Math.round(buildRetention * 100) / 100,
                    notes: [
                        'Upskill existing recruiters/consultants; lower acquisition cost.',
                        'Best when quality + retention matter more than speed.'
                    ]
                },
                buy: {
                    cost: Math.round(buyCost),
                    timeMonths: baseBuyTime,
                    retentionProb: Math.round(buyRetention * 100) / 100,
                    notes: [
                        'Faster time-to-fill for urgent client ramps.',
                        'Higher churn risk and higher cost-per-hire under peak demand.'
                    ]
                },
                recommendation,
                assumptions: [
                    `Urgency set to ${urgency}/5.`,
                    `Volume set to ${targetHires} hire(s).`,
                    'Costs are directional: training time, lost productivity, recruiting overhead, and onboarding.'
                ]
            };
        }

        // Pharma / enterprise (original mock) with light sensitivity to urgency
        const buildTime = 18 - Math.min(6, (urgency - 3) * 2); // can’t really compress too much
        const buyTime = Math.max(2, 4 - (urgency - 3));

        const buildCost = 15000 + (urgency - 3) * 2500;
        const buyCost = 45000 + (urgency - 3) * 3500;

        const buildRetention = 0.92;
        const buyRetention = 0.65;

        return {
            role,
            build: {
                cost: Math.round(buildCost),
                timeMonths: buildTime,
                retentionProb: buildRetention,
                notes: ['Higher culture fit and longer tenure; slower ramp in regulated roles.']
            },
            buy: {
                cost: Math.round(buyCost),
                timeMonths: buyTime,
                retentionProb: buyRetention,
                notes: ['Fastest path for urgent capability gaps; higher flight risk.']
            },
            recommendation: urgency >= 4 ? 'BUY' : 'BUILD',
            assumptions: [`Urgency set to ${urgency}/5.`, 'Costs are directional for demo purposes.']
        };
    }

    private generateStaffingPath(currentRole: string, targetRole: string): CareerPath {
        const from = currentRole.toLowerCase();
        const to = targetRole.toLowerCase();

        if (from.includes('coordinator') && to.includes('recruiter')) {
            return {
                id: 'path_coord_to_recruiter',
                sourceRole: currentRole,
                targetRole,
                totalDurationMonths: 4,
                feasibilityScore: 82,
                gapsToClose: ['Structured Screening', 'Sourcing Outreach', 'ATS Workflow'],
                steps: [
                    {
                        type: 'TRAINING',
                        roleTitle: 'Recruiting Foundations',
                        durationMonths: 1,
                        requiredSkills: ['ATS Basics', 'Candidate Experience', 'Compliance Basics'],
                        description: 'Complete internal recruiting bootcamp and shadow a senior recruiter.'
                    },
                    {
                        type: 'PROJECT',
                        roleTitle: 'Sourcing Sprint (Pilot)',
                        durationMonths: 1,
                        requiredSkills: ['LinkedIn Sourcing', 'Outbound Messaging', 'Screening Notes'],
                        description: 'Run a supervised sourcing sprint for one client requisition and build a shortlist.'
                    },
                    {
                        type: 'ROLE',
                        roleTitle: 'Junior Recruiter',
                        durationMonths: 2,
                        requiredSkills: ['Screening', 'Scheduling', 'Stakeholder Updates'],
                        description: 'Own low-risk roles end-to-end with KPI coaching (speed/quality).'
                    }
                ]
            };
        }

        if (from.includes('sourcer') && to.includes('recruiter')) {
            return {
                id: 'path_sourcer_to_recruiter',
                sourceRole: currentRole,
                targetRole,
                totalDurationMonths: 3,
                feasibilityScore: 88,
                gapsToClose: ['Stakeholder Management', 'Structured Interviews'],
                steps: [
                    {
                        type: 'TRAINING',
                        roleTitle: 'Interviewing & Calibration',
                        durationMonths: 1,
                        requiredSkills: ['Structured Questions', 'Scorecards', 'Bias Mitigation'],
                        description: 'Learn structured interviewing and quality calibration with hiring managers.'
                    },
                    {
                        type: 'PROJECT',
                        roleTitle: 'Screening Queue Ownership',
                        durationMonths: 1,
                        requiredSkills: ['Screening', 'Notes', 'Disposition'],
                        description: 'Own the screening queue for one desk; measure pass-through and time-to-submit.'
                    },
                    {
                        type: 'ROLE',
                        roleTitle: targetRole,
                        durationMonths: 1,
                        requiredSkills: ['Full-cycle Recruiting', 'Offer Coordination'],
                        description: 'Step into full-cycle responsibilities with mentorship.'
                    }
                ]
            };
        }

        if (from.includes('recruiter') && (to.includes('senior') || to.includes('lead'))) {
            return {
                id: 'path_recruiter_to_senior',
                sourceRole: currentRole,
                targetRole,
                totalDurationMonths: 6,
                feasibilityScore: 75,
                gapsToClose: ['Client SLA Management', 'Pipeline Analytics', 'Coaching'],
                steps: [
                    {
                        type: 'PROJECT',
                        roleTitle: 'Desk Optimization Project',
                        durationMonths: 2,
                        requiredSkills: ['Funnel Metrics', 'Process Improvement', 'Automation'],
                        description: 'Improve pass-through and reduce time-to-interview via process changes.'
                    },
                    {
                        type: 'TRAINING',
                        roleTitle: 'Client & Stakeholder Mastery',
                        durationMonths: 1,
                        requiredSkills: ['Client Communication', 'Expectation Setting', 'Escalations'],
                        description: 'Practice SLA negotiation and escalation handling.'
                    },
                    {
                        type: 'ROLE',
                        roleTitle: targetRole,
                        durationMonths: 3,
                        requiredSkills: ['Coaching', 'Quality Bar', 'Capacity Planning'],
                        description: 'Own key client relationships and coach 1-2 recruiters.'
                    }
                ]
            };
        }

        // Generic staffing fallback path
        return {
            id: 'path_staffing_generic',
            sourceRole: currentRole,
            targetRole,
            totalDurationMonths: 6,
            feasibilityScore: 65,
            gapsToClose: ['Domain Knowledge', 'Stakeholder Communication'],
            steps: [
                {
                    type: 'TRAINING',
                    roleTitle: 'Role Domain Basics',
                    durationMonths: 1,
                    requiredSkills: ['Industry Fundamentals'],
                    description: 'Learn the desk domain and common hiring signals.'
                },
                {
                    type: 'PROJECT',
                    roleTitle: 'Shadow + Co-own Requisition',
                    durationMonths: 2,
                    requiredSkills: ['Workflow', 'Candidate Notes'],
                    description: 'Shadow a top performer and co-own one requisition end-to-end.'
                },
                {
                    type: 'ROLE',
                    roleTitle: targetRole,
                    durationMonths: 3,
                    requiredSkills: ['Execution', 'Quality', 'Client Updates'],
                    description: 'Transition into the target role with a 30/60/90 plan.'
                }
            ]
        };
    }
}

export const careerPathService = new CareerPathService();
