/**
 * Graph Migration Service
 * Migrates existing candidates to Knowledge Graph by creating relationships
 * for companies, schools, and skills from existing metadata
 */

import { supabase } from './supabaseClient';
import { processingMarkerService } from './ProcessingMarkerService';

export interface MigrationConfig {
    batchSize: number;        // Candidates to process per batch (default: 100)
    checkpointInterval: number; // Save progress every N candidates (default: 500)
}

export interface MigrationProgress {
    jobId: string;
    total: number;
    completed: number;
    failed: number;
    currentBatch: number;
    totalBatches: number;
    status: 'running' | 'paused' | 'completed' | 'failed';
    startTime: Date;
    lastUpdate: Date;
    estimatedTimeRemaining?: string;
    errors: string[];
}

export type MigrationProgressCallback = (progress: MigrationProgress) => void;

interface CandidateRecord {
    id: string;
    candidate_id?: string;
    metadata: {
        id?: string;
        name?: string;
        title?: string;
        currentCompany?: string;
        company?: string;
        industry?: string;
        education?: string;
        skills?: string[];
        experienceYears?: number;
    };
}

class GraphMigrationService {
    private currentJobId: string | null = null;
    private isRunning: boolean = false;
    private isPaused: boolean = false;

    private readonly migrationMarkJobId = 'graph_migration';

    /**
     * Start migration of existing candidates
     */
    async startMigration(
        config: MigrationConfig,
        onProgress?: MigrationProgressCallback,
        resumeJobId?: string
    ): Promise<MigrationProgress> {
        if (!supabase) {
            throw new Error('Supabase is not configured');
        }

        this.isRunning = true;
        this.isPaused = false;

        // Get total count of candidates
        const { count: totalCount } = await supabase
            .from('candidate_documents')
            .select('*', { count: 'exact', head: true });

        if (!totalCount || totalCount === 0) {
            throw new Error('No candidates found to migrate');
        }

        // Resume existing job or create new one
        let progress: MigrationProgress;
        if (resumeJobId) {
            const resumed = await this.loadProgress(resumeJobId);
            if (resumed) {
                progress = resumed;
                progress.status = 'running';
            } else {
                throw new Error(`Migration job ${resumeJobId} not found`);
            }
        } else {
            progress = this.createNewProgress(totalCount, config);
            this.currentJobId = progress.jobId;
            await this.saveProgress(progress);
        }

        try {
            // Process in batches
            while (progress.currentBatch < progress.totalBatches && this.isRunning && !this.isPaused) {
                const batchStart = progress.currentBatch * config.batchSize;
                if (batchStart >= progress.total) break;

                const batchEnd = Math.min(batchStart + config.batchSize, progress.total);

                console.log(`[Migration] Processing batch ${progress.currentBatch + 1}/${progress.totalBatches} (${batchStart}-${batchEnd})`);

                // Fetch batch of candidates
                const viewish = await supabase
                    .from('candidate_documents')
                    .select('id, candidate_id, metadata')
                    .range(batchStart, batchEnd - 1);

                const fallback = viewish.error
                    ? await supabase.from('candidate_documents').select('id, metadata').range(batchStart, batchEnd - 1)
                    : null;

                const { data: candidates, error: fetchError } = (viewish.error ? fallback : viewish) as any;

                if (fetchError || !candidates) {
                    throw new Error(`Failed to fetch candidates: ${fetchError?.message}`);
                }

                // Process batch
                const results = await this.processBatch(candidates as CandidateRecord[]);

                // Update progress
                progress.completed += results.succeeded;
                progress.failed += results.failed;
                progress.currentBatch++;
                progress.lastUpdate = new Date();
                progress.estimatedTimeRemaining = this.calculateETA(progress);

                if (results.errors.length > 0) {
                    progress.errors.push(...results.errors.slice(0, 10)); // Keep only last 10 errors
                }

                // Save checkpoint
                const processedSoFar = Math.min(progress.currentBatch * config.batchSize, progress.total);
                if (processedSoFar % config.checkpointInterval === 0) {
                    await this.saveProgress(progress);
                }

                // Report progress
                if (onProgress) {
                    onProgress(progress);
                }
            }

            // Final status
            if (progress.currentBatch >= progress.totalBatches) {
                progress.status = 'completed';
            } else if (this.isPaused) {
                progress.status = 'paused';
            }

            await this.saveProgress(progress);
            this.isRunning = false;

            return progress;

        } catch (error) {
            progress.status = 'failed';
            progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
            await this.saveProgress(progress);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Pause the current migration
     */
    pause(): void {
        this.isPaused = true;
    }

    /**
     * Stop the current migration
     */
    stop(): void {
        this.isRunning = false;
    }

    /**
     * Process a batch of candidates
     */
    private async processBatch(
        candidates: CandidateRecord[]
    ): Promise<{ succeeded: number; failed: number; errors: string[] }> {
        let succeeded = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const candidate of candidates) {
            try {
                const stableCandidateId = String(candidate.candidate_id || candidate.metadata?.id || candidate.id);
                if (!stableCandidateId || stableCandidateId.startsWith('undefined')) {
                    failed++;
                    errors.push('Candidate missing stable id (metadata.id); skipping.');
                    continue;
                }

                const shouldRun = await processingMarkerService.beginStep({
                    candidateId: stableCandidateId,
                    jobId: this.migrationMarkJobId,
                    step: 'migrate_candidate_v1',
                    ttlMs: 1000 * 60 * 5
                });

                if (!shouldRun) {
                    // Already migrated (or another run is currently processing it)
                    succeeded++;
                    continue;
                }

                await this.migrateCandidate(candidate);
                await processingMarkerService.completeStep({
                    candidateId: stableCandidateId,
                    jobId: this.migrationMarkJobId,
                    step: 'migrate_candidate_v1'
                });

                succeeded++;
            } catch (error) {
                failed++;
                const candidateName = candidate.metadata?.name || candidate.metadata?.id || candidate.id;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to migrate ${candidateName}: ${errorMsg}`);
            }
        }

        return { succeeded, failed, errors };
    }

    /**
     * Migrate a single candidate
     */
    private async migrateCandidate(candidate: CandidateRecord): Promise<void> {
        if (!supabase) return;

        const metadata = candidate.metadata;
        if (!metadata) return;

        const candidateId = String(candidate.candidate_id || metadata.id || candidate.id);
        if (!candidateId || candidateId.startsWith('undefined')) return;

        // Create company relationship
        const company = metadata.currentCompany || metadata.company;
        if (company) {
            await this.createCompanyRelationship(
                candidateId,
                company,
                metadata.industry || 'Technology',
                metadata.title || 'Unknown',
                metadata.experienceYears || 3
            );
        }

        // Create school relationship
        if (metadata.education) {
            await this.createSchoolRelationship(
                candidateId,
                metadata.education,
                metadata.experienceYears || 3
            );
        }

        // Create skill relationships
        if (metadata.skills && metadata.skills.length > 0) {
            await this.createSkillRelationships(
                candidateId,
                metadata.skills,
                metadata.experienceYears || 3
            );
        }
    }

    /**
     * Create company relationship
     */
    private async createCompanyRelationship(
        candidateId: string,
        companyName: string,
        industry: string,
        title: string,
        yearsOfExperience: number
    ): Promise<void> {
        if (!supabase) return;

        // Get or create company
        const { data: companyData, error: companyError } = await supabase
            .rpc('get_or_create_company', {
                company_name: companyName,
                company_industry: industry
            });

        if (companyError || !companyData) {
            console.warn(`[Migration] Failed to get/create company ${companyName}:`, companyError);
            return;
        }

        const companyId = companyData;

        // Calculate employment dates
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - Math.min(yearsOfExperience, 5));

        // Upsert relationship to avoid 409 conflicts on UNIQUE(candidate_id, company_id, start_date)
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const { error: relationError } = await supabase
            .from('candidate_companies')
            .upsert(
                {
                    candidate_id: candidateId,
                    company_id: companyId,
                    title: title,
                    start_date: startDateStr,
                    end_date: endDateStr,
                    is_current: true
                },
                { onConflict: 'candidate_id,company_id,start_date' }
            );

        if (relationError) {
            console.warn(`[Migration] Failed to create company relationship:`, relationError);
        }
    }

    private normalizeDegree(rawDegree: string): 'High School' | 'Associate' | "Bachelor's" | "Master's" | 'PhD' | 'Bootcamp' | 'Certificate' | null {
        const d = (rawDegree || '').toLowerCase();
        if (!d) return null;

        if (d.includes('bootcamp')) return 'Bootcamp';
        if (d.includes('certificate') || d.includes('cert')) return 'Certificate';
        if (d.includes('high school') || d.includes('secondary') || d.includes('diploma')) return 'High School';
        if (d.includes('associate') || d.includes("a.a") || d.includes("a.s") || d.includes('aas')) return 'Associate';
        if (d.includes('phd') || d.includes('doctor') || d.includes('doctorate')) return 'PhD';
        if (d.includes('master') || d.includes('mba') || d.includes('msc') || d.includes('m.s') || d.includes('ms ') || d === 'ms' || d.includes('m.a') || d === 'ma') return "Master's";
        if (d.includes('bachelor') || d.includes('bsc') || d.includes('b.s') || d === 'bs' || d.includes('b.a') || d === 'ba') return "Bachelor's";

        return null;
    }

    /**
     * Create school relationship
     */
    private async createSchoolRelationship(
        candidateId: string,
        education: string,
        yearsOfExperience: number
    ): Promise<void> {
        if (!supabase) return;

        // Parse education string
        const educationParts = education.split(' - ');
        const degreeRaw = educationParts[0] || education;
        const schoolName = educationParts[1] || education;

        // Determine school type
        let schoolType: 'university' | 'college' | 'bootcamp' | 'online' = 'university';
        if (schoolName.toLowerCase().includes('bootcamp')) {
            schoolType = 'bootcamp';
        } else if (schoolName.toLowerCase().includes('online') || schoolName.toLowerCase().includes('udacity') || schoolName.toLowerCase().includes('coursera')) {
            schoolType = 'online';
        } else if (schoolName.toLowerCase().includes('college')) {
            schoolType = 'college';
        }

        // Get or create school
        const { data: schoolData, error: schoolError } = await supabase
            .rpc('get_or_create_school', {
                school_name: schoolName,
                school_type: schoolType
            });

        if (schoolError || !schoolData) {
            console.warn(`[Migration] Failed to get/create school ${schoolName}:`, schoolError);
            return;
        }

        const schoolId = schoolData;

        // Calculate graduation year
        const currentYear = new Date().getFullYear();
        const graduationYear = currentYear - yearsOfExperience - 1;

        const normalizedDegree = this.normalizeDegree(degreeRaw);
        const eduLower = (education || '').toLowerCase();
        const fieldOfStudy =
            eduLower.includes('computer') || eduLower.includes('software')
                ? 'Computer Science'
                : eduLower.includes('business') || eduLower.includes('finance') || eduLower.includes('accounting')
                    ? 'Business'
                    : eduLower.includes('design') || eduLower.includes('ux') || eduLower.includes('ui')
                        ? 'Design'
                        : 'Other';

        // Upsert relationship (avoids duplicates + degree check violations)
        const { error: relationError } = await supabase
            .from('candidate_schools')
            .upsert(
                {
                    candidate_id: candidateId,
                    school_id: schoolId,
                    degree: normalizedDegree,
                    field_of_study: fieldOfStudy,
                    graduation_year: graduationYear
                },
                { onConflict: 'candidate_id,school_id,degree' }
            );

        if (relationError) {
            console.warn(`[Migration] Failed to create school relationship:`, relationError);
        }
    }

    /**
     * Create skill relationships
     */
    private async createSkillRelationships(
        candidateId: string,
        skills: string[],
        yearsOfExperience: number
    ): Promise<void> {
        if (!supabase) return;

        const uniqueSkills = Array.from(
            new Set(
                skills
                    .map((s) => (typeof s === 'string' ? s.trim() : ''))
                    .filter((s) => s.length > 0)
                    .map((s) => s.toLowerCase())
            )
        );

        for (const skillKey of uniqueSkills) {
            const skillName = skillKey;
            try {
                // Determine skill category
                const category = this.categorizeSkill(skillName);

                // Get or create skill
                const { data: skillData, error: skillError } = await supabase
                    .rpc('get_or_create_skill', {
                        skill_name: skillName,
                        skill_category: category
                    });

                if (skillError || !skillData) {
                    console.warn(`[Migration] Failed to get/create skill ${skillName}:`, skillError);
                    continue;
                }

                const skillId = skillData;

                // Determine proficiency (ensure valid number and valid proficiency level)
                let safeYearsOfExperience = Number(yearsOfExperience);
                if (isNaN(safeYearsOfExperience) || safeYearsOfExperience < 0) {
                    safeYearsOfExperience = 3; // Default to 3 years
                }

                // Explicitly determine proficiency level (must match DB check constraint)
                let proficiency: 'beginner' | 'intermediate' | 'expert';
                if (safeYearsOfExperience < 2) proficiency = 'beginner';
                else if (safeYearsOfExperience < 5) proficiency = 'intermediate';
                else proficiency = 'expert';

                const yearsWithSkill = Math.min(safeYearsOfExperience, Math.random() * safeYearsOfExperience);

                // Upsert relationship to avoid 409 conflicts on UNIQUE(candidate_id, skill_id)
                const { error: relationError } = await supabase
                    .from('candidate_skills')
                    .upsert(
                        {
                            candidate_id: candidateId,
                            skill_id: skillId,
                            proficiency_level: proficiency,
                            years_of_experience: yearsWithSkill
                        },
                        { onConflict: 'candidate_id,skill_id' }
                    );

                if (relationError) {
                    console.warn(`[Migration] Failed to create skill relationship for ${skillName}:`, relationError);
                }
            } catch (error) {
                console.warn(`[Migration] Error processing skill ${skillName}:`, error);
            }
        }
    }

    /**
     * Categorize a skill
     */
    private categorizeSkill(skillName: string): string {
        const skill = skillName.toLowerCase();

        if (['javascript', 'python', 'java', 'typescript', 'c++', 'c#', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin', 'scala'].some(lang => skill.includes(lang))) {
            return 'programming';
        }

        if (['react', 'angular', 'vue', 'django', 'flask', 'spring', 'express', 'rails', 'laravel', 'nextjs', 'svelte'].some(fw => skill.includes(fw))) {
            return 'framework';
        }

        if (['docker', 'kubernetes', 'git', 'jenkins', 'terraform', 'ansible', 'aws', 'azure', 'gcp', 'sql', 'mongodb', 'postgresql', 'redis'].some(tool => skill.includes(tool))) {
            return 'tool';
        }

        if (['leadership', 'communication', 'teamwork', 'problem solving', 'agile', 'scrum', 'management'].some(soft => skill.includes(soft))) {
            return 'soft-skill';
        }

        return 'domain';
    }

    /**
     * Create new progress object
     */
    private createNewProgress(total: number, config: MigrationConfig): MigrationProgress {
        return {
            jobId: `migration-${Date.now()}`,
            total: total,
            completed: 0,
            failed: 0,
            currentBatch: 0,
            totalBatches: Math.ceil(total / config.batchSize),
            status: 'running',
            startTime: new Date(),
            lastUpdate: new Date(),
            errors: []
        };
    }

    /**
     * Save progress to Supabase
     */
    private async saveProgress(progress: MigrationProgress): Promise<void> {
        if (!supabase) return;

        const { error } = await supabase
            .from('graph_migration_progress')
            .upsert({
                job_id: progress.jobId,
                total: progress.total,
                completed: progress.completed,
                failed: progress.failed,
                current_batch: progress.currentBatch,
                total_batches: progress.totalBatches,
                status: progress.status,
                start_time: progress.startTime.toISOString(),
                last_update: progress.lastUpdate.toISOString(),
                errors: progress.errors
            }, {
                onConflict: 'job_id'
            });

        if (error) {
            console.error('[Migration] Failed to save progress:', error);
        }
    }

    /**
     * Load progress from Supabase
     */
    private async loadProgress(jobId: string): Promise<MigrationProgress | null> {
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('graph_migration_progress')
            .select('*')
            .eq('job_id', jobId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            jobId: data.job_id,
            total: data.total,
            completed: data.completed,
            failed: data.failed,
            currentBatch: data.current_batch,
            totalBatches: data.total_batches,
            status: data.status,
            startTime: new Date(data.start_time),
            lastUpdate: new Date(data.last_update),
            errors: data.errors || []
        };
    }

    /**
     * Calculate estimated time remaining
     */
    private calculateETA(progress: MigrationProgress): string {
        const elapsed = Date.now() - progress.startTime.getTime();
        const rate = progress.completed / (elapsed / 1000); // candidates per second
        const remaining = progress.total - progress.completed;
        const secondsRemaining = remaining / rate;

        if (secondsRemaining < 60) {
            return `${Math.round(secondsRemaining)}s`;
        } else if (secondsRemaining < 3600) {
            return `${Math.round(secondsRemaining / 60)}m`;
        } else {
            const hours = Math.floor(secondsRemaining / 3600);
            const minutes = Math.round((secondsRemaining % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    /**
     * Get total number of candidates in the database
     */
    async getTotalCandidates(): Promise<number> {
        if (!supabase) return 0;

        const { count, error } = await supabase
            .from('candidate_documents')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('[Migration] Failed to get candidate count:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * Get all migration jobs
     */
    async getAllJobs(): Promise<MigrationProgress[]> {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('graph_migration_progress')
            .select('*')
            .order('start_time', { ascending: false });

        if (error || !data) {
            return [];
        }

        return data.map(row => ({
            jobId: row.job_id,
            total: row.total,
            completed: row.completed,
            failed: row.failed,
            currentBatch: row.current_batch,
            totalBatches: row.total_batches,
            status: row.status,
            startTime: new Date(row.start_time),
            lastUpdate: new Date(row.last_update),
            errors: row.errors || []
        }));
    }

    /**
     * Delete a migration job
     */
    async deleteJob(jobId: string): Promise<void> {
        if (!supabase) return;

        await supabase
            .from('graph_migration_progress')
            .delete()
            .eq('job_id', jobId);
    }

    /**
     * Check if migration is running
     */
    isJobRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get current job ID
     */
    getCurrentJobId(): string | null {
        return this.currentJobId;
    }
}

export const graphMigrationService = new GraphMigrationService();
