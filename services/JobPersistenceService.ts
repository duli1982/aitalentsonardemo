import { supabase } from './supabaseClient';
import type { Job } from '../types';

export class JobPersistenceService {
    isAvailable(): boolean {
        return Boolean(supabase);
    }

    async getAll(): Promise<Job[]> {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[JobPersistenceService] Failed to fetch jobs:', error);
            return [];
        }

        return (data || []).map(this.mapFromDb);
    }

    async upsertJob(job: Job): Promise<Job | null> {
        if (!supabase) return null;

        const payload = this.mapToDb(job);

        const { data, error } = await supabase
            .from('jobs')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('[JobPersistenceService] Failed to upsert job:', error);
            return null;
        }

        return this.mapFromDb(data);
    }

    async deleteJob(id: string): Promise<boolean> {
        if (!supabase) return false;

        const { error } = await supabase
            .from('jobs')
            .update({ deleted_at: new Date().toISOString() } as any)
            .eq('id', id);

        if (error) {
            console.error('[JobPersistenceService] Failed to delete job:', error);
            return false;
        }

        return true;
    }

    private mapToDb(job: Job): any {
        return {
            id: job.id,
            title: job.title,
            department: job.department,
            location: job.location,
            job_type: job.type || 'Full-time',
            description: job.description || '',
            required_skills: job.requiredSkills || [],
            status: job.status,
            posted_date: job.postedDate || undefined,
            company_context: job.companyContext || {},
            updated_at: new Date().toISOString()
        };
    }

    private mapFromDb(row: any): Job {
        return {
            id: row.id,
            title: row.title,
            department: row.department,
            location: row.location,
            type: row.job_type,
            description: row.description,
            requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
            status: row.status,
            companyContext: row.company_context || {},
            postedDate: row.posted_date || row.created_at
        };
    }
}

export const jobPersistenceService = new JobPersistenceService();
