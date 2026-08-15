import type { Candidate, InternalCandidate, PastCandidate, UploadedCandidate } from '../types';

export const detectHiddenGem = (candidate: Candidate): boolean => {
    // 1. Internal Candidates: High performance + High potential (Learning Agility)
    if (candidate.type === 'internal') {
        const internal = candidate as InternalCandidate;
        const learningAgility = internal.learningAgility ?? 0;
        const experienceYears = internal.experienceYears ?? 0;
        // High performer (>=4) AND High Agility (>=4)
        // OR High performer (5) with < 3 years experience (Fast riser)
        if (internal.performanceRating >= 4 && learningAgility >= 4) return true;
        if (internal.performanceRating === 5 && experienceYears < 3) return true;

        // Check for "Junior" title but high skills count
        if (internal.currentRole.toLowerCase().includes('junior') && internal.skills.length > 6) return true;
    }

    // 2. Past Candidates: Positive keywords in notes + "Silver Medalist" traits
    if (candidate.type === 'past') {
        const past = candidate as PastCandidate;
        const notes = past.notes?.toLowerCase() || '';
        const positiveKeywords = ['bright', 'quick learner', 'strong potential', 'highly recommended', 'excellent', 'impressive', 'culture fit'];

        // If notes contain positive keywords
        if (positiveKeywords.some(keyword => notes.includes(keyword))) return true;

        // If they were a "near miss" (silver medalist) - e.g. "hired more senior" implies they were good
        if (notes.includes('hired a more senior') || notes.includes('budget') || notes.includes('timing')) return true;
    }

    // 3. Uploaded Candidates: Keyword analysis in summary + Skill density
    if (candidate.type === 'uploaded') {
        const uploaded = candidate as UploadedCandidate;
        const summary = uploaded.summary?.toLowerCase() || '';
        const experienceYears = uploaded.experienceYears ?? 0;
        const gemKeywords = ['award', 'honor', 'patent', 'summa cum laude', 'valedictorian', 'exceptional', 'proven track record', 'rapidly promoted'];

        if (gemKeywords.some(keyword => summary.includes(keyword))) return true;

        // High skill density for experience level (e.g. < 5 years but many skills)
        if (experienceYears < 5 && uploaded.skills.length > 8) return true;

        // RIP Qualification for Regulatory roles (Specific to current context)
        if (uploaded.skills.some(s => s.toLowerCase().includes('rip') || s.toLowerCase().includes('responsible person'))) return true;
    }

    return false;
};
