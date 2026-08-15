import type { OrganizationRole } from '../contexts/AuthContext';

export const MANAGER_ROLES: OrganizationRole[] = ['owner', 'admin', 'team_lead', 'sourcing_manager'];

export function canViewTeamPerformance(role?: OrganizationRole): boolean {
  return Boolean(role && MANAGER_ROLES.includes(role));
}

export function canManageAllocations(role?: OrganizationRole): boolean {
  return Boolean(role && MANAGER_ROLES.includes(role));
}

export function canConfigureRecruiters(role?: OrganizationRole): boolean {
  return canViewTeamPerformance(role);
}

export function canGenerateTalentIntel(role?: OrganizationRole): boolean {
  return Boolean(role && ['owner', 'admin', 'team_lead', 'sourcing_manager', 'recruiter'].includes(role));
}

export function canShareTalentIntel(role?: OrganizationRole): boolean {
  return canViewTeamPerformance(role);
}

export function canAccessWorkforcePlanning(role?: OrganizationRole): boolean {
  return Boolean(role && ['owner', 'admin', 'team_lead', 'sourcing_manager', 'hiring_manager'].includes(role));
}
