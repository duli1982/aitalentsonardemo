export type AgentKey = 'sourcing' | 'screening' | 'scheduling' | 'interview' | 'analytics';

export type AgentMode = 'recommend' | 'auto_write';

export interface AgentSettings {
  enabled: boolean;
  mode: AgentMode;
}

interface AgentSettingsStoreV1 {
  version: 1;
  agents: Record<AgentKey, AgentSettings>;
}

const STORAGE_KEY = 'talentSonar:agentSettings:v1';

const DEFAULT_STORE: AgentSettingsStoreV1 = {
  version: 1,
  agents: {
    sourcing: { enabled: false, mode: 'recommend' },
    screening: { enabled: false, mode: 'recommend' },
    scheduling: { enabled: false, mode: 'recommend' },
    interview: { enabled: false, mode: 'recommend' },
    analytics: { enabled: false, mode: 'recommend' }
  }
};

function safeParse(raw: string | null): AgentSettingsStoreV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed.agents !== 'object') return null;
    return parsed as AgentSettingsStoreV1;
  } catch {
    return null;
  }
}

class AgentSettingsService {
  getAll(): AgentSettingsStoreV1 {
    if (typeof window === 'undefined') return DEFAULT_STORE;
    const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY));
    return parsed ?? DEFAULT_STORE;
  }

  getAgent(key: AgentKey): AgentSettings {
    const store = this.getAll();
    return store.agents[key] ?? DEFAULT_STORE.agents[key];
  }

  setEnabled(key: AgentKey, enabled: boolean): void {
    const store = this.getAll();
    const next: AgentSettingsStoreV1 = {
      ...store,
      agents: { ...store.agents, [key]: { ...(store.agents[key] ?? DEFAULT_STORE.agents[key]), enabled } }
    };
    this.save(next);
  }

  setMode(key: AgentKey, mode: AgentMode): void {
    const store = this.getAll();
    const next: AgentSettingsStoreV1 = {
      ...store,
      agents: { ...store.agents, [key]: { ...(store.agents[key] ?? DEFAULT_STORE.agents[key]), mode } }
    };
    this.save(next);
  }

  private save(store: AgentSettingsStoreV1): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }
}

export const agentSettingsService = new AgentSettingsService();

