export type DurableSourcingRun = { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; attempts: number; scheduled_for: string; claimed_at?: string; completed_at?: string; result: Record<string, unknown>; error_message?: string; created_at: string };
export type DurableSourcingMatch = { job_id: string; candidate_id: string; hybrid_score: number; semantic_score: number; structured_score: number; matched_skills: string[]; reasons: string[]; created_at: string };
const key = (organizationId: string) => `talentSonar:${organizationId}:sourcingRuns`;
const read = (organizationId: string): DurableSourcingRun[] => { try { const value = JSON.parse(localStorage.getItem(key(organizationId)) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
export const durableSourcingService = {
  async enqueue(organizationId: string, jobIds: string[] = []) { const now = new Date().toISOString(); const run: DurableSourcingRun = { id: globalThis.crypto?.randomUUID?.() || `run-${Date.now()}`, status: 'completed', attempts: 1, scheduled_for: now, claimed_at: now, completed_at: now, result: { jobIds, mode: 'local' }, created_at: now }; localStorage.setItem(key(organizationId), JSON.stringify([run, ...read(organizationId)].slice(0, 100))); return { ok: true, run }; },
  async status(organizationId: string): Promise<{ runs: DurableSourcingRun[]; matches: DurableSourcingMatch[] }> { return { runs: read(organizationId), matches: [] }; },
};
