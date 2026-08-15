import type { IntakeCallSession, IntakeScorecard } from '../types';
const SESSIONS = 'intake_call_sessions_v1';
const SCORECARDS = 'intake_scorecards_v1';
const epoch = (value?: string) => value ? Date.parse(value) || 0 : 0;
class IntakeCallPersistenceService {
  isAvailable(): boolean { return typeof localStorage !== 'undefined'; }
  async upsertSession(session: IntakeCallSession): Promise<void> { const all = this.read<IntakeCallSession>(SESSIONS); all[session.id] = session; localStorage.setItem(SESSIONS, JSON.stringify(all)); }
  async getSessionsByJob(jobId: string): Promise<IntakeCallSession[]> { return Object.values(this.read<IntakeCallSession>(SESSIONS)).filter((item) => item.jobId === jobId).sort((a, b) => epoch(b.startedAt) - epoch(a.startedAt)); }
  async getSessionById(sessionId: string): Promise<IntakeCallSession | null> { return this.read<IntakeCallSession>(SESSIONS)[sessionId] || null; }
  async upsertScorecard(scorecard: IntakeScorecard): Promise<void> { const all = this.read<IntakeScorecard>(SCORECARDS); if (scorecard.status === 'approved') Object.values(all).forEach((item) => { if (item.jobId === scorecard.jobId && item.id !== scorecard.id && item.status === 'approved') { item.status = 'revised'; item.updatedAt = new Date().toISOString(); } }); all[scorecard.id] = scorecard; localStorage.setItem(SCORECARDS, JSON.stringify(all)); }
  async getScorecardByJob(jobId: string): Promise<IntakeScorecard | null> { return Object.values(this.read<IntakeScorecard>(SCORECARDS)).filter((item) => item.jobId === jobId).sort((a, b) => epoch(b.updatedAt || b.createdAt) - epoch(a.updatedAt || a.createdAt))[0] || null; }
  async getApprovedScorecardForJob(jobId: string): Promise<IntakeScorecard | null> { return Object.values(this.read<IntakeScorecard>(SCORECARDS)).filter((item) => item.jobId === jobId && item.status === 'approved').sort((a, b) => epoch(b.approvedAt || b.updatedAt) - epoch(a.approvedAt || a.updatedAt))[0] || null; }
  private read<T>(key: string): Record<string, T> { try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } }
}
export const intakeCallPersistenceService = new IntakeCallPersistenceService();
