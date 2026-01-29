import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobPersistenceService } from '../JobPersistenceService';
import { supabase } from '../supabaseClient';
import { Job } from '../../types';

// Mock supabase client
vi.mock('../supabaseClient', () => ({
    supabase: {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
    },
}));

describe('JobPersistenceService', () => {
    let service: JobPersistenceService;

    beforeEach(() => {
        service = new JobPersistenceService();
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('should fetch jobs from supabase', async () => {
            const mockData = [
                {
                    id: '1',
                    title: 'Dev',
                    department: 'IT',
                    location: 'Remote',
                    job_type: 'Full-time',
                    description: 'Desc',
                    required_skills: ['React'],
                    status: 'open',
                    company_context: {},
                    created_at: '2025-01-01',
                },
            ];

            (supabase!.from as any).mockImplementation(() => ({
                select: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            }));

            const jobs = await service.getAll();

            expect(jobs.length).toBe(1);
            expect(jobs[0].title).toBe('Dev');
            expect(supabase!.from).toHaveBeenCalledWith('jobs');
        });

        it('should return empty array on error', async () => {
            (supabase!.from as any).mockImplementation(() => ({
                select: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'error' } }),
            }));

            const jobs = await service.getAll();
            expect(jobs).toEqual([]);
        });
    });

    describe('upsertJob', () => {
        it('should upsert job to supabase', async () => {
            const job: Job = {
                id: '1',
                title: 'Dev',
                department: 'IT',
                location: 'Remote',
                requiredSkills: ['React'],
                description: 'Desc',
                status: 'open',
            };

            const mockData = {
                id: '1',
                title: 'Dev',
                department: 'IT',
                location: 'Remote',
                job_type: 'Full-time',
                description: 'Desc',
                required_skills: ['React'],
                status: 'open',
                company_context: {},
                created_at: '2025-01-01',
            };

            (supabase!.from as any).mockImplementation(() => ({
                upsert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            }));

            const result = await service.upsertJob(job);

            expect(result?.id).toBe('1');
            expect(supabase!.from).toHaveBeenCalledWith('jobs');
        });
    });
});
