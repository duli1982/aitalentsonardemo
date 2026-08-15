export interface ProcessingMarkAcquireParams { candidateId: string; jobId: string; step: string; ttlMs?: number; metadata?: Record<string, unknown> }
type Mark = { key: string; status: 'started' | 'completed'; updatedAt: string; metadata: Record<string, unknown> };
const KEY = 'talentSonar:processingMarks';
const read = (): Mark[] => { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const markKey = (value: { candidateId: string; jobId: string; step: string }) => `${value.candidateId}:${value.jobId}:${value.step}`;
class ProcessingMarkerService {
  async beginStep(params: ProcessingMarkAcquireParams): Promise<boolean> { const key = markKey(params); const items = read(); const existing = items.find((item) => item.key === key); const ttl = params.ttlMs || 600000; if (existing?.status === 'completed' || (existing?.status === 'started' && Date.now() - Date.parse(existing.updatedAt) < ttl)) return false; localStorage.setItem(KEY, JSON.stringify([{ key, status: 'started', updatedAt: new Date().toISOString(), metadata: params.metadata || {} }, ...items.filter((item) => item.key !== key)])); return true; }
  async completeStep(params: { candidateId: string; jobId: string; step: string; metadata?: Record<string, unknown> }): Promise<void> { const key = markKey(params); localStorage.setItem(KEY, JSON.stringify([{ key, status: 'completed', updatedAt: new Date().toISOString(), metadata: params.metadata || {} }, ...read().filter((item) => item.key !== key)])); }
}
export const processingMarkerService = new ProcessingMarkerService();
