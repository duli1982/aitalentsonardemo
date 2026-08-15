export type AssessmentType = 'CODING_TEST' | 'LAB_SIMULATION' | 'CASE_STUDY' | 'LEARNING_MODULE';

export interface ValidatedSkill {
    skillName: string;
    proficiencyLevel: number; // 1-5
    confidenceScore: number; // 0-1
    verifiedAt: string; // ISO Date
    source: string; // e.g. "HackerRank", "Internal LMS", "Github"
    evidenceLink?: string;
}

export interface AssessmentResult {
    id: string;
    type: AssessmentType;
    title: string;
    dateCompleted: string;
    score: number; // 0-100
    skillsValidated: string[];
    feedback: string;
}

export interface SkillsPassport {
    verifiedSkills: ValidatedSkill[];
    assessmentHistory: AssessmentResult[];
    badges: string[]; // e.g. "Python Gold", "GMP Certified"
}
