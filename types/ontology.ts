// Single Source of Truth for Role Names
// In a real Vision 2030 system, this would likely be generated from a Graph Database Enum

export const ROLES = {
    // Manufacturing & Quality
    QC_ANALYST: 'QC Analyst',
    DATA_ANALYST: 'Data Analyst',
    LAB_TECHNICIAN: 'Lab Technician',
    PROCESS_ENGINEER: 'Process Engineer',
    SENIOR_QC: 'Senior QC',
    QUALITY_PERSON: 'Quality Person (QP)',
    PRODUCTION_LEAD: 'Production Lead',

    // R&D
    RESEARCH_CIENTIST: 'Research Scientist',

    // Generic / Leadership
    HIRING_MANAGER: 'Hiring Manager',

    // AI / specialized
    JUNIOR_DATA_ANALYST: 'Junior Data Analyst',
    DATA_CHAMPION: 'Data Champion (Hybrid)',
    QA_LEAD: 'Quality Assurance Lead',
    REGULATORY_SPECIALIST: 'Regulatory Affairs Specialist'
} as const;

export type RoleType = typeof ROLES[keyof typeof ROLES];

export const AGENT_ROLES = {
    HIRING_MANAGER: 'HIRING_MANAGER',
    CANDIDATE: 'CANDIDATE',
    RECRUITER: 'RECRUITER',
    HR_BP: 'HR_BP'
} as const;

export type AgentRoleType = typeof AGENT_ROLES[keyof typeof AGENT_ROLES];

// DEPARTMENTS - Eliminate magic strings for organization structure
export const DEPARTMENTS = {
    RD: 'R&D',
    MANUFACTURING: 'Manufacturing',
    QUALITY: 'Quality',
    REGULATORY: 'Regulatory Affairs',
    SUPPLY_CHAIN: 'Supply Chain',
    COMMERCIAL: 'Commercial',
    FINANCE: 'Finance',
    HR: 'Human Resources',
    IT: 'IT',
    DATA_SCIENCE: 'Data Science',
} as const;

export type DepartmentType = typeof DEPARTMENTS[keyof typeof DEPARTMENTS];

// LOCATIONS - Common site/location references
export const LOCATIONS = {
    DUBLIN: 'Dublin',
    CORK: 'Cork',
    LIMERICK: 'Limerick',
    GALWAY: 'Galway',
    REMOTE: 'Remote',
} as const;

export type LocationType = typeof LOCATIONS[keyof typeof LOCATIONS];

// SKILL_CATEGORIES - For grouping skills
export const SKILL_CATEGORIES = {
    TECHNICAL: 'Technical',
    SOFT: 'Soft Skills',
    DOMAIN: 'Domain Expertise',
    LEADERSHIP: 'Leadership',
    TOOLS: 'Tools & Platforms',
} as const;

export type SkillCategoryType = typeof SKILL_CATEGORIES[keyof typeof SKILL_CATEGORIES];
