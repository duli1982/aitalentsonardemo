import { aiService } from '../services/AIService';
import { supabase } from '../services/supabaseClient';
import { ALL_CANDIDATES } from '../data/candidates';
import type { Candidate } from '../types';

export interface MigrationProgress {
    total: number;
    current: number;
    status: 'running' | 'complete' | 'error';
    successCount: number;
    failureCount: number;
    currentCandidate?: string;
    errors: string[];
}

export type ProgressCallback = (progress: MigrationProgress) => void;

/**
 * Migrates all mock candidates from data/candidates.ts to Supabase vector database
 * Generates embeddings for each candidate and stores them with metadata
 */
export async function migrateAllCandidates(
    onProgress?: ProgressCallback
): Promise<MigrationProgress> {

    if (!supabase) {
        throw new Error('Supabase is not configured. Please add credentials to .env file.');
    }

    const progress: MigrationProgress = {
        total: ALL_CANDIDATES.length,
        current: 0,
        status: 'running',
        successCount: 0,
        failureCount: 0,
        errors: []
    };

    const reportProgress = () => {
        if (onProgress) onProgress({ ...progress });
    };

    reportProgress();

    for (const candidate of ALL_CANDIDATES) {
        progress.current++;
        progress.currentCandidate = candidate.name;
        reportProgress();

        try {
            // Generate comprehensive text summary for embedding
            const textContent = generateCandidateText(candidate);

            // Generate embedding
            const embeddingResult = await aiService.embedText(textContent);

            if (!embeddingResult.success || !embeddingResult.data) {
                throw new Error(`Failed to generate embedding: ${embeddingResult.error}`);
            }

            // Prepare metadata
            const metadata = {
                id: candidate.id,
                type: candidate.type,
                name: candidate.name,
                email: candidate.email,
                skills: candidate.skills,
                experienceYears: candidate.experienceYears,
                ...(candidate.type === 'internal' && {
                    currentRole: candidate.currentRole,
                    department: candidate.department,
                    performanceRating: candidate.performanceRating
                }),
                ...(candidate.type === 'past' && {
                    previousRoleAppliedFor: candidate.previousRoleAppliedFor,
                    lastContactDate: candidate.lastContactDate
                }),
                ...(candidate.type === 'uploaded' && {
                    summary: candidate.summary,
                    fileName: candidate.fileName
                })
            };

            // Insert into Supabase
            const { error } = await supabase
                .from('candidate_documents')
                .insert({
                    content: textContent,
                    metadata,
                    embedding: embeddingResult.data
                });

            if (error) {
                throw new Error(`Supabase error: ${error.message}`);
            }

            progress.successCount++;
        } catch (err) {
            progress.failureCount++;
            const errorMsg = `${candidate.name}: ${String(err)}`;
            progress.errors.push(errorMsg);
            console.error(`Migration error for ${candidate.name}:`, err);
        }

        reportProgress();
    }

    progress.status = progress.failureCount === 0 ? 'complete' : 'error';
    reportProgress();

    return progress;
}

/**
 * Generates rich text content for a candidate to be embedded
 * Includes all relevant information for semantic search
 */
function generateCandidateText(candidate: Candidate): string {
    const parts: string[] = [
        `Name: ${candidate.name}`,
        `Email: ${candidate.email || 'Not provided'}`
    ];

    // Type-specific information
    if (candidate.type === 'internal') {
        parts.push(`Type: Internal Employee`);
        parts.push(`Current Role: ${candidate.currentRole}`);
        parts.push(`Department: ${candidate.department}`);
        parts.push(`Performance Rating: ${candidate.performanceRating}/5`);
        if (candidate.careerAspirations) {
            parts.push(`Career Aspirations: ${candidate.careerAspirations}`);
        }
        if (candidate.developmentGoals) {
            parts.push(`Development Goals: ${candidate.developmentGoals}`);
        }
    } else if (candidate.type === 'past') {
        parts.push(`Type: Past Candidate`);
        if (candidate.previousRoleAppliedFor) {
            parts.push(`Previously Applied For: ${candidate.previousRoleAppliedFor}`);
        }
        if (candidate.lastContactDate) {
            parts.push(`Last Contact: ${candidate.lastContactDate}`);
        }
        if (candidate.notes) {
            parts.push(`Notes: ${candidate.notes}`);
        }
    } else if (candidate.type === 'uploaded') {
        parts.push(`Type: External Candidate`);
        if (candidate.summary) {
            parts.push(`Summary: ${candidate.summary}`);
        }
    }

    // Common fields
    if (candidate.skills && candidate.skills.length > 0) {
        parts.push(`Skills: ${candidate.skills.join(', ')}`);
    }

    if (candidate.experienceYears !== undefined) {
        parts.push(`Years of Experience: ${candidate.experienceYears}`);
    }

    return parts.join('\n');
}

/**
 * Checks how many candidates from data/candidates.ts are already in the vector DB
 */
export async function checkMigrationStatus(): Promise<{
    totalMockCandidates: number;
    migratedCount: number;
    needsMigration: boolean;
}> {
    if (!supabase) {
        return {
            totalMockCandidates: ALL_CANDIDATES.length,
            migratedCount: 0,
            needsMigration: true
        };
    }

    const mockIds = ALL_CANDIDATES.map(c => c.id);

    const { data, error } = await supabase
        .from('candidate_documents')
        .select('metadata');

    if (error) {
        console.error('Error checking migration status:', error);
        return {
            totalMockCandidates: ALL_CANDIDATES.length,
            migratedCount: 0,
            needsMigration: true
        };
    }

    const migratedIds = new Set(
        data
            ?.map((doc: any) => doc.metadata?.id)
            .filter(Boolean) || []
    );

    const migratedCount = mockIds.filter(id => migratedIds.has(id)).length;

    return {
        totalMockCandidates: ALL_CANDIDATES.length,
        migratedCount,
        needsMigration: migratedCount < ALL_CANDIDATES.length
    };
}
