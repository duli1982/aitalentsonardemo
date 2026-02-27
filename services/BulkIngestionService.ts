/**
 * Bulk Ingestion Service
 * Generates and ingests 100K+ candidate profiles to vector database
 *
 * Features:
 * - Batch processing (100-1000 profiles per batch)
 * - Parallel embedding generation
 * - Progress tracking in Supabase
 * - Resumability from checkpoints
 * - Error handling and retry logic
 */

import { supabase } from './supabaseClient';
import { aiService } from './AIService';
import { candidatePersistenceService } from './CandidatePersistenceService';
import {
    JOB_ROLE_TEMPLATES,
    FIRST_NAMES,
    LAST_NAMES,
    COMPANIES,
    UNIVERSITIES,
    getRandomItem,
    getRandomItems,
    type JobRoleTemplate
} from '../data/jobRoleTemplates';

export interface BulkIngestionConfig {
    targetCount: number;          // Total profiles to generate (e.g., 100000)
    batchSize: number;             // Profiles per batch (e.g., 500)
    parallelism: number;           // Concurrent embedding requests (e.g., 10)
    checkpointInterval: number;    // Save progress every N profiles (e.g., 1000)
}

export interface BulkIngestionProgress {
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

export interface BulkProfile {
    name: string;
    title: string;
    email: string;
    yearsOfExperience: number;
    skills: string[];
    education: string;
    location: string;
    company: string;
    industry: string;
    summary: string;
}

export type ProgressCallback = (progress: BulkIngestionProgress) => void;

class BulkIngestionService {
    private currentJobId: string | null = null;
    private isRunning: boolean = false;
    private isPaused: boolean = false;

    /**
     * Start or resume bulk ingestion
     */
    async startBulkIngestion(
        config: BulkIngestionConfig,
        onProgress?: ProgressCallback,
        resumeJobId?: string
    ): Promise<BulkIngestionProgress> {
        if (!supabase) {
            throw new Error('Supabase is not configured');
        }

        if (!aiService.isAvailable()) {
            throw new Error('AI service is not available. Please configure VITE_GEMINI_API_KEY');
        }

        this.isRunning = true;
        this.isPaused = false;

        // Resume existing job or create new one
        let progress: BulkIngestionProgress;
        if (resumeJobId) {
            const resumed = await this.loadProgress(resumeJobId);
            if (resumed) {
                progress = resumed;
                progress.status = 'running';
            } else {
                throw new Error(`Job ${resumeJobId} not found`);
            }
        } else {
            progress = this.createNewProgress(config);
            this.currentJobId = progress.jobId;
            await this.saveProgress(progress);
        }

        try {
            // Process in batches
            while (progress.completed < progress.total && this.isRunning && !this.isPaused) {
                const batchStart = progress.completed;
                const batchEnd = Math.min(batchStart + config.batchSize, progress.total);
                const batchCount = batchEnd - batchStart;

                console.log(`[BulkIngestion] Processing batch ${progress.currentBatch + 1}/${progress.totalBatches} (${batchStart}-${batchEnd})`);

                // Generate profiles for this batch
                const profiles = this.generateProfiles(batchCount);

                // Ingest profiles with parallelism
                const results = await this.ingestBatch(profiles, config.parallelism);

                // Update progress
                progress.completed += results.succeeded;
                progress.failed += results.failed;
                progress.currentBatch++;
                progress.lastUpdate = new Date();
                progress.estimatedTimeRemaining = this.calculateETA(progress);

                if (results.errors.length > 0) {
                    progress.errors.push(...results.errors);
                }

                // Save checkpoint
                if (progress.completed % config.checkpointInterval === 0) {
                    await this.saveProgress(progress);
                }

                // Report progress
                if (onProgress) {
                    onProgress(progress);
                }
            }

            // Final status
            if (progress.completed >= progress.total) {
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
     * Pause the current bulk ingestion
     */
    pause(): void {
        this.isPaused = true;
    }

    /**
     * Stop the current bulk ingestion
     */
    stop(): void {
        this.isRunning = false;
    }

    /**
     * Generate random candidate profiles
     */
    private generateProfiles(count: number): BulkProfile[] {
        const profiles: BulkProfile[] = [];

        for (let i = 0; i < count; i++) {
            const roleTemplate = getRandomItem(JOB_ROLE_TEMPLATES);
            const profile = this.generateProfile(roleTemplate);
            profiles.push(profile);
        }

        return profiles;
    }

    /**
     * Generate a single profile from template
     */
    private generateProfile(template: JobRoleTemplate): BulkProfile {
        const firstName = getRandomItem(FIRST_NAMES);
        const lastName = getRandomItem(LAST_NAMES);
        const name = `${firstName} ${lastName}`;
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;

        const yearsOfExperience = Math.floor(
            Math.random() * (template.experienceRange[1] - template.experienceRange[0] + 1)
        ) + template.experienceRange[0];

        const skills = getRandomItems(template.skills, Math.min(template.skills.length, 5 + Math.floor(Math.random() * 3)));
        const education = getRandomItem(template.educationLevels);
        const location = getRandomItem(template.locations);
        const company = getRandomItem(COMPANIES);
        const industry = getRandomItem(template.industries);

        // Generate summary
        const summary = this.generateSummary(template.title, yearsOfExperience, skills, company, template.category);

        return {
            name,
            title: template.title,
            email,
            yearsOfExperience,
            skills,
            education,
            location,
            company,
            industry,
            summary
        };
    }

    /**
     * Generate a realistic summary
     */
    private generateSummary(
        title: string,
        years: number,
        skills: string[],
        company: string,
        category: string
    ): string {
        const experienceLevel = years < 3 ? 'junior' : years < 7 ? 'mid-level' : 'senior';
        const topSkills = skills.slice(0, 3).join(', ');

        const templates = [
            `${experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1)} ${title} with ${years}+ years of experience in ${category.toLowerCase()}. Currently at ${company}, specializing in ${topSkills}. Passionate about building scalable solutions and mentoring team members.`,
            `Experienced ${title} with ${years} years in the industry. Strong background in ${topSkills}. Previously worked at ${company} on high-impact projects. Seeking opportunities to leverage technical expertise in innovative environments.`,
            `${title} with proven track record in ${category.toLowerCase()}. ${years}+ years of hands-on experience with ${topSkills}. Known for delivering quality work and collaborating effectively with cross-functional teams at ${company}.`,
            `Results-driven ${title} specializing in ${topSkills}. ${years} years of professional experience, including recent work at ${company}. Committed to continuous learning and staying current with industry best practices.`
        ];

        return getRandomItem(templates);
    }

    /**
     * Ingest a batch of profiles with parallel processing
     */
    private async ingestBatch(
        profiles: BulkProfile[],
        parallelism: number
    ): Promise<{ succeeded: number; failed: number; errors: string[] }> {
        let succeeded = 0;
        let failed = 0;
        const errors: string[] = [];

        // Process profiles in chunks for parallelism
        for (let i = 0; i < profiles.length; i += parallelism) {
            const chunk = profiles.slice(i, i + parallelism);

            const results = await Promise.allSettled(
                chunk.map(profile => this.ingestSingleProfile(profile))
            );

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    succeeded++;
                } else {
                    failed++;
                    const profileName = chunk[index].name;
                    errors.push(`Failed to ingest ${profileName}: ${result.reason}`);
                }
            });
        }

        return { succeeded, failed, errors };
    }

    /**
     * Ingest a single profile
     */
    private async ingestSingleProfile(profile: BulkProfile): Promise<void> {
        const candidateId = this.generateCandidateId();

        // Build content string
        const content = this.buildContentString(profile);

        // Generate embedding
        const embeddingResult = await aiService.embedText(content);

        if (!embeddingResult.success || !embeddingResult.data) {
            throw new Error('Failed to generate embedding');
        }

        const metadata = {
            id: candidateId,
            name: profile.name,
            title: profile.title,
            email: profile.email,
            skills: profile.skills,
            experienceYears: profile.yearsOfExperience,
            education: profile.education,
            location: profile.location,
            currentCompany: profile.company,
            industry: profile.industry,
            type: 'uploaded', // Mark as uploaded type
            source: 'bulk_ingestion'
        };

        await candidatePersistenceService.upsertCandidateAndActiveDocument({
            candidateId,
            fullName: profile.name,
            email: profile.email,
            title: profile.title,
            location: profile.location,
            experienceYears: profile.yearsOfExperience,
            skills: profile.skills,
            candidateMetadata: metadata,
            documentContent: content,
            documentMetadata: metadata,
            embedding: embeddingResult.data,
            source: 'bulk_ingestion'
        });

        // Create graph relationships (don't fail entire profile if relationships fail)
        try {
            await this.createGraphRelationships(candidateId, profile);
        } catch (relationshipError) {
            console.warn(`[BulkIngestion] Failed to create relationships for ${profile.name}:`, relationshipError);
            // Don't throw - profile was successfully created, just missing relationships
        }
    }

    private generateCandidateId(): string {
        const maybeCrypto = globalThis.crypto as Crypto | undefined;
        if (maybeCrypto?.randomUUID) {
            return maybeCrypto.randomUUID();
        }
        return `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * Create knowledge graph relationships for a candidate
     */
    private async createGraphRelationships(candidateId: string, profile: BulkProfile): Promise<void> {
        // Create company relationship
        await this.createCompanyRelationship(candidateId, profile);

        // Create school relationship
        await this.createSchoolRelationship(candidateId, profile);

        // Create skill relationships
        await this.createSkillRelationships(candidateId, profile);
    }

    /**
     * Create company relationship
     */
    private async createCompanyRelationship(candidateId: string, profile: BulkProfile): Promise<void> {
        if (!profile.company) return;

        // Get or create company
        const { data: companyData, error: companyError } = await supabase!
            .rpc('get_or_create_company', {
                company_name: profile.company,
                company_industry: profile.industry || 'Technology'
            });

        if (companyError || !companyData) {
            console.warn(`Failed to get/create company ${profile.company}:`, companyError);
            return;
        }

        const companyId = companyData;

        // Calculate employment dates based on experience
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - Math.min(profile.yearsOfExperience, 5));

        // Upsert candidate-company relationship to avoid 409 conflicts on UNIQUE(candidate_id, company_id, start_date)
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const { error: relationError } = await supabase!
            .from('candidate_companies')
            .upsert(
                {
                    candidate_id: candidateId,
                    company_id: companyId,
                    title: profile.title,
                    start_date: startDateStr,
                    end_date: endDateStr,
                    is_current: true
                },
                { onConflict: 'candidate_id,company_id,start_date' }
            );

        if (relationError) {
            console.warn(`Failed to create company relationship:`, relationError);
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
    private async createSchoolRelationship(candidateId: string, profile: BulkProfile): Promise<void> {
        if (!profile.education) return;

        // Parse education string (e.g., "Bachelor's in Computer Science - Stanford University")
        const educationParts = profile.education.split(' - ');
        const degreeRaw = educationParts[0] || profile.education;
        const schoolName = educationParts[1] || 'Unknown University';

        // Determine school type based on name
        let schoolType: 'university' | 'college' | 'bootcamp' | 'online' = 'university';
        if (schoolName.toLowerCase().includes('bootcamp')) {
            schoolType = 'bootcamp';
        } else if (schoolName.toLowerCase().includes('online') || schoolName.toLowerCase().includes('udacity') || schoolName.toLowerCase().includes('coursera')) {
            schoolType = 'online';
        } else if (schoolName.toLowerCase().includes('college')) {
            schoolType = 'college';
        }

        // Get or create school
        const { data: schoolData, error: schoolError } = await supabase!
            .rpc('get_or_create_school', {
                school_name: schoolName,
                school_type: schoolType
            });

        if (schoolError || !schoolData) {
            console.warn(`Failed to get/create school ${schoolName}:`, schoolError);
            return;
        }

        const schoolId = schoolData;

        // Calculate graduation year
        const currentYear = new Date().getFullYear();
        const graduationYear = currentYear - profile.yearsOfExperience - 1;

        const normalizedDegree = this.normalizeDegree(degreeRaw);
        const eduLower = profile.education.toLowerCase();
        const fieldOfStudy =
            eduLower.includes('computer') || eduLower.includes('software')
                ? 'Computer Science'
                : eduLower.includes('business') || eduLower.includes('finance') || eduLower.includes('accounting')
                    ? 'Business'
                    : eduLower.includes('design') || eduLower.includes('ux') || eduLower.includes('ui')
                        ? 'Design'
                        : 'Other';

        // Upsert candidate-school relationship to avoid degree check violations + duplicates
        const { error: relationError } = await supabase!
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
            console.warn(`Failed to create school relationship:`, relationError);
        }
    }

    /**
     * Create skill relationships
     */
    private async createSkillRelationships(candidateId: string, profile: BulkProfile): Promise<void> {
        if (!profile.skills || profile.skills.length === 0) return;

        const uniqueSkills = Array.from(
            new Set(
                profile.skills
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
                const { data: skillData, error: skillError } = await supabase!
                    .rpc('get_or_create_skill', {
                        skill_name: skillName,
                        skill_category: category
                    });

                if (skillError || !skillData) {
                    console.warn(`Failed to get/create skill ${skillName}:`, skillError);
                    continue;
                }

                const skillId = skillData;

                // Determine proficiency based on experience (must match DB check constraint)
                const proficiency =
                    profile.yearsOfExperience < 2
                        ? 'beginner'
                        : profile.yearsOfExperience < 5
                            ? 'intermediate'
                            : 'expert';

                const yearsWithSkill = Math.min(profile.yearsOfExperience, Math.random() * profile.yearsOfExperience);

                // Upsert candidate-skill relationship to avoid duplicates
                const { error: relationError } = await supabase!
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
                    console.warn(`Failed to create skill relationship for ${skillName}:`, relationError);
                }
            } catch (error) {
                console.warn(`Error processing skill ${skillName}:`, error);
            }
        }
    }

    /**
     * Categorize a skill into one of the predefined categories
     */
    private categorizeSkill(skillName: string): string {
        const skill = skillName.toLowerCase();

        // Programming languages
        if (['javascript', 'python', 'java', 'typescript', 'c++', 'c#', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin', 'scala'].some(lang => skill.includes(lang))) {
            return 'programming';
        }

        // Frameworks
        if (['react', 'angular', 'vue', 'django', 'flask', 'spring', 'express', 'rails', 'laravel', 'nextjs', 'svelte'].some(fw => skill.includes(fw))) {
            return 'framework';
        }

        // Tools
        if (['docker', 'kubernetes', 'git', 'jenkins', 'terraform', 'ansible', 'aws', 'azure', 'gcp', 'sql', 'mongodb', 'postgresql', 'redis'].some(tool => skill.includes(tool))) {
            return 'tool';
        }

        // Soft skills
        if (['leadership', 'communication', 'teamwork', 'problem solving', 'agile', 'scrum', 'management'].some(soft => skill.includes(soft))) {
            return 'soft-skill';
        }

        // Default to domain knowledge
        return 'domain';
    }

    /**
     * Build content string for embedding
     */
    private buildContentString(profile: BulkProfile): string {
        return `
${profile.name} - ${profile.title}
Location: ${profile.location}
Years of Experience: ${profile.yearsOfExperience}
Current Company: ${profile.company}
Industry: ${profile.industry}
Education: ${profile.education}

Skills: ${profile.skills.join(', ')}

Summary: ${profile.summary}

Email: ${profile.email}
        `.trim();
    }

    /**
     * Create new progress object
     */
    private createNewProgress(config: BulkIngestionConfig): BulkIngestionProgress {
        return {
            jobId: `bulk-${Date.now()}`,
            total: config.targetCount,
            completed: 0,
            failed: 0,
            currentBatch: 0,
            totalBatches: Math.ceil(config.targetCount / config.batchSize),
            status: 'running',
            startTime: new Date(),
            lastUpdate: new Date(),
            errors: []
        };
    }

    /**
     * Save progress to Supabase
     */
    private async saveProgress(progress: BulkIngestionProgress): Promise<void> {
        if (!supabase) return;

        const { error } = await supabase
            .from('bulk_ingestion_progress')
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
            console.error('[BulkIngestion] Failed to save progress:', error);
        }
    }

    /**
     * Load progress from Supabase
     */
    private async loadProgress(jobId: string): Promise<BulkIngestionProgress | null> {
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('bulk_ingestion_progress')
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
    private calculateETA(progress: BulkIngestionProgress): string {
        const elapsed = Date.now() - progress.startTime.getTime();
        const rate = progress.completed / (elapsed / 1000); // profiles per second
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
     * Get all jobs
     */
    async getAllJobs(): Promise<BulkIngestionProgress[]> {
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('bulk_ingestion_progress')
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
     * Delete a job
     */
    async deleteJob(jobId: string): Promise<void> {
        if (!supabase) return;

        await supabase
            .from('bulk_ingestion_progress')
            .delete()
            .eq('job_id', jobId);
    }

    /**
     * Get current job status
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

export const bulkIngestionService = new BulkIngestionService();
