import { AssessmentResult, AssessmentType, ValidatedSkill } from '../types/assessment';
import { Candidate } from '../types';

export class SkillsInferenceService {

    public ingestAssessment(candidate: Candidate, result: AssessmentResult): Candidate {
        // 1. Infer Skills from Result
        const newSkills = this.mapAssessmentToSkills(result);

        // 2. Update/Create Passport
        const currentPassport = candidate.passport || { verifiedSkills: [], badges: [] };

        // Merge skills (Logic: Newest verification overwrites old if score is higher, or simple append)
        const updatedSkills = [...currentPassport.verifiedSkills];

        newSkills.forEach(newSkill => {
            const existingIndex = updatedSkills.findIndex(s => s.skillName === newSkill.skillName);
            if (existingIndex > -1) {
                // Update if level is higher
                if (newSkill.proficiencyLevel >= updatedSkills[existingIndex].proficiencyLevel) {
                    updatedSkills[existingIndex] = newSkill;
                }
            } else {
                updatedSkills.push(newSkill);
            }
        });

        // 3. Award Badges
        const newBadges = [...currentPassport.badges];
        if (result.score > 80) {
            newBadges.push(`${result.title} Master`);
        }

        return {
            ...candidate,
            passport: {
                verifiedSkills: updatedSkills,
                badges: Array.from(new Set(newBadges)) // Dedup
            }
        };
    }

    private mapAssessmentToSkills(result: AssessmentResult): ValidatedSkill[] {
        // Mock Inference Logic
        // passing a "Python Sim" -> Python Skill

        const skills: ValidatedSkill[] = [];

        result.skillsValidated.forEach(skillName => {
            // Calculate level based on score
            let level = 1;
            if (result.score > 90) level = 5;
            else if (result.score > 75) level = 4;
            else if (result.score > 60) level = 3;
            else level = 2;

            skills.push({
                skillName,
                proficiencyLevel: level,
                confidenceScore: 0.9, // High confidence since it's an assessment
                verifiedAt: new Date().toISOString(),
                source: result.type,
                evidenceLink: `https://sonar.assessments/${result.id}`
            });
        });

        return skills;
    }
}

export const skillsInferenceService = new SkillsInferenceService();
