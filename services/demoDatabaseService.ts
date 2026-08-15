/**
 * Demo Database Service
 * Provides a built-in candidate database for testing without Google Drive authentication
 *
 * API Optimization Strategy:
 * - Two-tier screening: Fast skill matching → AI analysis only for top candidates
 * - Caching: Store results in localStorage to avoid re-analyzing same job
 * - User control: Choose how many candidates to fully analyze (5, 10, or 20)
 *
 * Expected API savings: 50-90% reduction in Gemini calls
 */

import type { UploadedCandidate, Job } from '../types';
import mockCandidatesData from '../data/mockCandidates.json';
import { fitAnalysisService } from './FitAnalysisService';
import { TIMING } from '../config/timing';

export interface DemoLoadProgress {
  current: number;
  total: number;
  candidateName: string;
  currentScore?: number;
  isAiAnalysis?: boolean; // true if using AI, false if using skill matching
}

export interface MatchedCandidate {
  candidate: UploadedCandidate;
  matchScore: number;
  matchRationale: string;
}

export interface MatchTierResults {
  excellent: MatchedCandidate[];  // 80%+
  good: MatchedCandidate[];       // 65-79%
  moderate: MatchedCandidate[];   // 50-64%
  low: MatchedCandidate[];        // 30-49%
  poor: MatchedCandidate[];       // <30%
}

/**
 * Load demo candidates with realistic progress simulation
 */
export const loadDemoCandidates = async (
  onProgress?: (progress: DemoLoadProgress) => void
): Promise<UploadedCandidate[]> => {
  const candidates: UploadedCandidate[] = [];

  for (let i = 0; i < mockCandidatesData.length; i++) {
    const mockCandidate = mockCandidatesData[i];

    // Report progress
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: mockCandidatesData.length,
        candidateName: mockCandidate.name
      });
    }

    // Convert to UploadedCandidate format
    const candidate: UploadedCandidate = {
      id: `demo-${Date.now()}-${i}`,
      type: 'uploaded',
      name: mockCandidate.name,
      email: mockCandidate.email,
      skills: mockCandidate.skills,
      experienceYears: mockCandidate.experienceYears,
      summary: mockCandidate.summary,
      fileName: mockCandidate.fileName,
      matchScores: {},
      matchRationales: {}
    };

    candidates.push(candidate);

    // Simulate processing time (50-150ms per candidate)
    await new Promise(resolve =>
      setTimeout(resolve, TIMING.DEMO_DB_CANDIDATE_MIN_DELAY_MS + Math.random() * TIMING.DEMO_DB_CANDIDATE_RANDOM_DELAY_MS)
    );
  }

  return candidates;
};

/**
 * Get demo database statistics
 */
export const getDemoStats = () => {
  const totalCandidates = mockCandidatesData.length;
  const uniqueSkills = new Set(mockCandidatesData.flatMap(c => c.skills));
  const avgExperience = mockCandidatesData.reduce((sum, c) => sum + c.experienceYears, 0) / totalCandidates;

  const locations = mockCandidatesData
    .map(c => (c as any).location)
    .filter(Boolean);

  return {
    totalCandidates,
    uniqueSkillsCount: uniqueSkills.size,
    averageExperience: Math.round(avgExperience * 10) / 10,
    locationsCount: new Set(locations).size,
    topSkills: getTopSkills(5)
  };
};

/**
 * Get top N most common skills
 */
const getTopSkills = (count: number): string[] => {
  const skillCounts = new Map<string, number>();

  mockCandidatesData.forEach(candidate => {
    candidate.skills.forEach(skill => {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    });
  });

  return Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([skill]) => skill);
};

/**
 * Check if demo database has been loaded before
 */
export const isDemoDatabaseLoaded = (): boolean => {
  const loaded = localStorage.getItem('demoDatabaseLoaded');
  return loaded === 'true';
};

/**
 * Mark demo database as loaded
 */
export const markDemoDatabaseAsLoaded = (): void => {
  localStorage.setItem('demoDatabaseLoaded', 'true');
};

/**
 * Reset demo database state
 */
export const resetDemoDatabase = (): void => {
  localStorage.removeItem('demoDatabaseLoaded');
};

/**
 * Get sample candidate for preview
 */
export const getSampleCandidate = (): any => {
  return mockCandidatesData[Math.floor(Math.random() * mockCandidatesData.length)];
};

/**
 * Generate a cache key for job requirements
 * Used to cache AI analysis results in localStorage
 */
const getJobCacheKey = (job: Job): string => {
  const keyData = {
    title: job.title,
    skills: job.requiredSkills.sort(),
    description: job.description.substring(0, 100) // First 100 chars to detect changes
  };
  return `match-cache-${JSON.stringify(keyData)}`;
};

/**
 * Get cached match results for a job
 */
const getCachedResults = (job: Job): MatchTierResults | null => {
  try {
    const cacheKey = getJobCacheKey(job);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is less than 24 hours old
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        console.log('✅ Using cached match results (saved', (20 - (data.aiAnalyzedCount || 20)), 'API calls)');
        return data.results;
      }
    }
  } catch (error) {
    console.error('Failed to read cache:', error);
  }
  return null;
};

/**
 * Save match results to cache
 */
const setCachedResults = (job: Job, results: MatchTierResults, aiAnalyzedCount: number): void => {
  try {
    const cacheKey = getJobCacheKey(job);
    localStorage.setItem(cacheKey, JSON.stringify({
      results,
      timestamp: Date.now(),
      aiAnalyzedCount
    }));
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
};

/**
 * Fast skill-based matching (no API calls)
 * Returns a score 0-100 based on:
 * - Skill overlap (70 points)
 * - Keywords in summary (30 points)
 */
const calculateQuickMatchScore = (job: Job, candidateData: any): number => {
  let score = 0;

  // 1. Skill matching (70 points max)
  const jobSkills = job.requiredSkills.map(s => s.toLowerCase());
  const candidateSkills = candidateData.skills.map((s: string) => s.toLowerCase());
  const matchedSkills = candidateSkills.filter((s: string) => jobSkills.includes(s));
  const skillScore = jobSkills.length > 0 ? (matchedSkills.length / jobSkills.length) * 70 : 0;
  score += skillScore;

  // 2. Title/summary keyword matching (30 points max)
  const jobKeywords = [
    job.title.toLowerCase(),
    ...job.requiredSkills.map(s => s.toLowerCase()),
    ...job.description.toLowerCase().split(' ').filter(w => w.length > 4).slice(0, 10)
  ];
  const summary = (candidateData.summary || '').toLowerCase();
  const keywordMatches = jobKeywords.filter(keyword => summary.includes(keyword)).length;
  score += Math.min(30, keywordMatches * 3);

  return Math.round(score);
};

/**
 * Scan database and find matching candidates for a specific job
 *
 * OPTIMIZED FOR API EFFICIENCY:
 * - Checks cache first (saves all API calls on repeat scans)
 * - Uses fast skill matching to pre-screen all candidates (0 API calls)
 * - Only analyzes top N candidates with AI (default 10, saves 50% API calls)
 * - Rest get quick match scores
 *
 * @param job - The job to match against
 * @param onProgress - Progress callback
 * @param maxAiAnalysis - Max candidates to analyze with AI (default: 10, max: 20)
 */
export const scanDatabaseForMatches = async (
  job: Job,
  onProgress?: (progress: DemoLoadProgress) => void,
  maxAiAnalysis: number = 10
): Promise<MatchTierResults> => {
  // Step 1: Check cache
  const cachedResults = getCachedResults(job);
  if (cachedResults) {
    return cachedResults;
  }

  console.log(`🚀 Starting optimized scan: ${maxAiAnalysis} AI analyses (saving ${20 - maxAiAnalysis} API calls)`);

  // Step 2: Quick pre-screening with skill matching (0 API calls)
  const prescreenedCandidates = mockCandidatesData.map((mockCandidate, i) => {
    const candidate: UploadedCandidate = {
      id: `demo-${Date.now()}-${i}`,
      type: 'uploaded',
      name: mockCandidate.name,
      email: mockCandidate.email,
      skills: mockCandidate.skills,
      experienceYears: mockCandidate.experienceYears,
      summary: mockCandidate.summary,
      fileName: mockCandidate.fileName,
      matchScores: {},
      matchRationales: {}
    };

    const quickScore = calculateQuickMatchScore(job, mockCandidate);

    return {
      candidate,
      mockData: mockCandidate,
      quickScore
    };
  });

  // Sort by quick score (best first)
  prescreenedCandidates.sort((a, b) => b.quickScore - a.quickScore);

  console.log(`📊 Pre-screening complete. Top candidate: ${prescreenedCandidates[0].candidate.name} (${prescreenedCandidates[0].quickScore}% quick score)`);

  // Step 3: AI analysis for top N candidates only
  const matchedCandidates: MatchedCandidate[] = [];
  let aiAnalysisCount = 0;

  for (let i = 0; i < prescreenedCandidates.length; i++) {
    const { candidate, mockData, quickScore } = prescreenedCandidates[i];

    // Report progress
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: prescreenedCandidates.length,
        candidateName: candidate.name,
        isAiAnalysis: i < maxAiAnalysis
      });
    }

    // Use AI for top N, quick score for rest
    if (i < maxAiAnalysis) {
      try {
        // AI analysis
        const analysis = await fitAnalysisService.analyze(job, candidate);
        aiAnalysisCount++;

        matchedCandidates.push({
          candidate,
          matchScore: analysis.score,
          matchRationale: analysis.rationale
        });

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: prescreenedCandidates.length,
            candidateName: candidate.name,
            currentScore: analysis.score,
            isAiAnalysis: true
          });
        }

        // Small delay to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, TIMING.DEMO_DB_AI_RATE_LIMIT_DELAY_MS));
      } catch (error) {
        console.error(`Failed to AI analyze ${candidate.name}:`, error);
        // Fallback to quick score
        matchedCandidates.push({
          candidate,
          matchScore: quickScore,
          matchRationale: `Skills match: ${mockData.skills.filter((s: string) => job.requiredSkills.map(js => js.toLowerCase()).includes(s.toLowerCase())).join(', ') || 'None'}. ${mockData.experienceYears} years experience.`
        });
      }
    } else {
      // Use quick score (no API call)
      const matchedSkills = mockData.skills.filter((s: string) =>
        job.requiredSkills.map(js => js.toLowerCase()).includes(s.toLowerCase())
      );

      matchedCandidates.push({
        candidate,
        matchScore: quickScore,
        matchRationale: matchedSkills.length > 0
          ? `Quick match based on skills: ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? '...' : ''}. ${mockData.experienceYears} years experience.`
          : `General profile match. ${mockData.experienceYears} years experience in related field.`
      });

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: prescreenedCandidates.length,
          candidateName: candidate.name,
          currentScore: quickScore,
          isAiAnalysis: false
        });
      }

      // Small delay for UI smoothness
      await new Promise(resolve => setTimeout(resolve, TIMING.DEMO_DB_UI_SMOOTHNESS_DELAY_MS));
    }
  }

  // Sort into tiers
  const tiers: MatchTierResults = {
    excellent: matchedCandidates.filter(m => m.matchScore >= 80),
    good: matchedCandidates.filter(m => m.matchScore >= 65 && m.matchScore < 80),
    moderate: matchedCandidates.filter(m => m.matchScore >= 50 && m.matchScore < 65),
    low: matchedCandidates.filter(m => m.matchScore >= 30 && m.matchScore < 50),
    poor: matchedCandidates.filter(m => m.matchScore < 30)
  };

  // Sort each tier by score (highest first)
  Object.values(tiers).forEach(tier => {
    tier.sort((a: MatchedCandidate, b: MatchedCandidate) => b.matchScore - a.matchScore);
  });

  console.log(`✅ Scan complete! Used ${aiAnalysisCount} AI analyses (saved ${20 - aiAnalysisCount} API calls)`);
  console.log(`📈 Results: ${tiers.excellent.length} excellent, ${tiers.good.length} good, ${tiers.moderate.length} moderate`);

  // Cache results
  setCachedResults(job, tiers, aiAnalysisCount);

  return tiers;
};

/**
 * Import candidates from match results based on selected tier
 */
export const importMatchedCandidates = (
  matchResults: MatchTierResults,
  job: Job,
  includeTiers: ('excellent' | 'good' | 'moderate' | 'low')[]
): UploadedCandidate[] => {
  const candidates: UploadedCandidate[] = [];

  includeTiers.forEach(tier => {
    matchResults[tier].forEach(match => {
      // Add match scores to candidate
      const candidate = {
        ...match.candidate,
        matchScores: { [job.id]: match.matchScore },
        matchRationales: { [job.id]: match.matchRationale }
      };
      candidates.push(candidate);
    });
  });

  return candidates;
};
