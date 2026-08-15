import { AGENT_ROLES, AgentRoleType } from '../types/ontology';

export const PERMISSIONS = {
    VIEW_OWN_PROFILE: 'VIEW_OWN_PROFILE',
    VIEW_INTERNAL_CANDIDATES: 'VIEW_INTERNAL_CANDIDATES',
    VIEW_JOB_DETAILS: 'VIEW_JOB_DETAILS',
    EXECUTE_SEARCH: 'EXECUTE_SEARCH',
    VIEW_SALARY_DATA: 'VIEW_SALARY_DATA'
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ROLE_POLICIES: Record<AgentRoleType, Permission[]> = {
    [AGENT_ROLES.HIRING_MANAGER]: [
        PERMISSIONS.VIEW_OWN_PROFILE,
        PERMISSIONS.VIEW_INTERNAL_CANDIDATES,
        PERMISSIONS.VIEW_JOB_DETAILS,
        PERMISSIONS.EXECUTE_SEARCH,
        PERMISSIONS.VIEW_SALARY_DATA
    ],
    [AGENT_ROLES.CANDIDATE]: [
        PERMISSIONS.VIEW_OWN_PROFILE,
        PERMISSIONS.VIEW_JOB_DETAILS
    ],
    [AGENT_ROLES.RECRUITER]: [
        PERMISSIONS.VIEW_OWN_PROFILE,
        PERMISSIONS.VIEW_INTERNAL_CANDIDATES,
        PERMISSIONS.VIEW_JOB_DETAILS,
        PERMISSIONS.EXECUTE_SEARCH
    ],
    [AGENT_ROLES.HR_BP]: [
        PERMISSIONS.VIEW_OWN_PROFILE,
        PERMISSIONS.VIEW_INTERNAL_CANDIDATES,
        PERMISSIONS.VIEW_JOB_DETAILS,
        PERMISSIONS.EXECUTE_SEARCH,
        PERMISSIONS.VIEW_SALARY_DATA
    ]
};

export const hasPermission = (role: AgentRoleType | string, permission: Permission): boolean => {
    // Cast to AgentRoleType if valid, or default to empty
    const policies = ROLE_POLICIES[role as AgentRoleType];
    if (!policies) return false;
    return policies.includes(permission);
};
