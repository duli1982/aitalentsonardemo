import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type OrganizationRole = 'owner' | 'admin' | 'team_lead' | 'sourcing_manager' | 'recruiter' | 'hiring_manager' | 'viewer';
export type LocalUser = { id: string; email: string };
export type LocalSession = { user: LocalUser };

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
}

interface AuthContextValue {
  user: LocalUser;
  session: LocalSession;
  memberships: OrganizationMembership[];
  activeOrganization: OrganizationMembership;
  isLoading: boolean;
  isDemoMode: boolean;
  signIn(email: string, password: string): Promise<{ error?: string }>;
  signUp(email: string, password: string): Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signOut(): Promise<void>;
  setActiveOrganization(organizationId: string): void;
  refreshMemberships(): Promise<void>;
}

const LOCAL_USER: LocalUser = { id: 'local-user', email: 'local@talentsonar.invalid' };
const LOCAL_MEMBERSHIP: OrganizationMembership = { organizationId: 'local-workspace', organizationName: 'Local workspace', organizationSlug: 'local-workspace', role: 'owner' };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOrganizationId, setActiveOrganizationId] = useState(LOCAL_MEMBERSHIP.organizationId);
  const memberships = useMemo(() => [LOCAL_MEMBERSHIP], []);
  const activeOrganization = memberships.find((item) => item.organizationId === activeOrganizationId) ?? LOCAL_MEMBERSHIP;
  const setActiveOrganization = useCallback((organizationId: string) => {
    if (memberships.some((item) => item.organizationId === organizationId)) setActiveOrganizationId(organizationId);
  }, [memberships]);
  const value = useMemo<AuthContextValue>(() => ({
    user: LOCAL_USER,
    session: { user: LOCAL_USER },
    memberships,
    activeOrganization,
    isLoading: false,
    isDemoMode: false,
    signIn: async () => ({}),
    signUp: async () => ({ needsEmailConfirmation: false }),
    signOut: async () => undefined,
    setActiveOrganization,
    refreshMemberships: async () => undefined,
  }), [activeOrganization, memberships, setActiveOrganization]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
