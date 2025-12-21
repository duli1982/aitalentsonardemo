// CandidateRepository - Repository pattern for data access
// Abstracts storage from business logic

import { apiClient } from '../services/ApiClient';
import { Candidate, UploadedCandidate } from '../types';

interface Repository<T> {
    getAll(): Promise<T[]>;
    getById(id: string): Promise<T | null>;
    create(data: Omit<T, 'id'>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T>;
    delete(id: string): Promise<void>;
}

class CandidateRepository implements Repository<Candidate | UploadedCandidate> {
    private endpoint = '/candidates';

    async getAll(): Promise<(Candidate | UploadedCandidate)[]> {
        try {
            return await apiClient.get<(Candidate | UploadedCandidate)[]>(this.endpoint) || [];
        } catch {
            return [];
        }
    }

    async getById(id: string): Promise<Candidate | UploadedCandidate | null> {
        try {
            return await apiClient.get<Candidate | UploadedCandidate>(`${this.endpoint}/${id}`);
        } catch {
            return null;
        }
    }

    async create(data: Omit<Candidate | UploadedCandidate, 'id'>): Promise<Candidate | UploadedCandidate> {
        const id = `c_${Date.now()}`;
        const candidate = { id, ...data } as Candidate | UploadedCandidate;
        await apiClient.post(this.endpoint, candidate);
        return candidate;
    }

    async update(id: string, data: Partial<Candidate | UploadedCandidate>): Promise<Candidate | UploadedCandidate> {
        const existing = await this.getById(id);
        if (!existing) throw new Error(`Candidate ${id} not found`);

        const updated = { ...existing, ...data };
        await apiClient.put(`${this.endpoint}/${id}`, updated);
        return updated;
    }

    async delete(id: string): Promise<void> {
        await apiClient.delete(`${this.endpoint}/${id}`);
    }

    // Domain-specific methods
    async getByStage(stage: string): Promise<(Candidate | UploadedCandidate)[]> {
        const all = await this.getAll();
        return all.filter(c => 'stage' in c && c.stage === stage);
    }

    async getBySkill(skill: string): Promise<(Candidate | UploadedCandidate)[]> {
        const all = await this.getAll();
        return all.filter(c => c.skills.some(s =>
            s.toLowerCase().includes(skill.toLowerCase())
        ));
    }

    async search(query: string): Promise<(Candidate | UploadedCandidate)[]> {
        const all = await this.getAll();
        const lowerQuery = query.toLowerCase();
        return all.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.skills.some(s => s.toLowerCase().includes(lowerQuery)) ||
            ('summary' in c && c.summary?.toLowerCase().includes(lowerQuery))
        );
    }
}

// Singleton export
export const candidateRepository = new CandidateRepository();
