import type { Candidate } from '../types';
import { ALL_CANDIDATES } from '../data/candidates';

const readArray = (key: string): Candidate[] => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };

export function readLocalCandidates(): Candidate[] {
  if (typeof localStorage === 'undefined') return ALL_CANDIDATES;
  const prefix = 'talentSonar:local-workspace';
  const candidates = [
    ...readArray(`${prefix}-internalCandidates`),
    ...readArray(`${prefix}-pastCandidates`),
    ...readArray(`${prefix}-uploadedCandidates`),
  ];
  return candidates.length ? candidates : ALL_CANDIDATES;
}
