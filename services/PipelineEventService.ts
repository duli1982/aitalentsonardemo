export type PipelineActorType = 'agent' | 'user' | 'system';
export interface PipelineEventCreate { candidateId: string; candidateName?: string; jobId: string; jobTitle?: string; eventType: string; actorType: PipelineActorType; actorId?: string; fromStage?: string; toStage?: string; summary: string; metadata?: Record<string, unknown> }
export interface PipelineEventRecord extends Omit<PipelineEventCreate, 'metadata'> { id: number; metadata: Record<string, unknown>; createdAt: string }
const KEY = 'talentSonar:pipelineEvents';
const read = (): PipelineEventRecord[] => { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
class PipelineEventService {
  async logEvent(event: PipelineEventCreate): Promise<void> { const items = read(); items.unshift({ ...event, id: Date.now(), metadata: event.metadata || {}, createdAt: new Date().toISOString() }); localStorage.setItem(KEY, JSON.stringify(items.slice(0, 2000))); }
  async listForCandidate(candidateId: string, limit = 50): Promise<PipelineEventRecord[]> { return read().filter((event) => event.candidateId === candidateId).slice(0, limit); }
}
export const pipelineEventService = new PipelineEventService();
