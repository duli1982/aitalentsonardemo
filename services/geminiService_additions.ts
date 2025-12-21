// Interview Scheduling Types and Function
export interface TimeSlot {
    date: string;
    time: string;
    timezone: string;
    probability: number;
}

export interface InterviewScheduleSuggestion {
    candidateId: string;
    candidateName: string;
    jobTitle: string;
    suggestedSlots: TimeSlot[];
    reasoning: string;
}

export const suggestInterviewTimes = async (
    candidate: Candidate,
    job: Job,
    interviewerTimezone: string
): Promise<InterviewScheduleSuggestion> => {
    const prompt = `
    You are an AI Interview Scheduling Assistant. Suggest optimal interview times.
    
    **Candidate:** ${candidate.name}
    **Position:** ${job.title}
    **Interviewer Timezone:** ${interviewerTimezone}
    
    **Task:**
    Suggest 3 optimal interview time slots for the next 7 days.
    Consider:
    - Standard business hours (9 AM - 5 PM)
    - Avoid Mondays (busy) and Fridays (people check out early)
    - Mid-morning (10-11 AM) or mid-afternoon (2-3 PM) are best
    - Provide timezone-aware suggestions
    
    Return structured JSON with time slots and reasoning.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        candidateId: { type: Type.STRING },
                        candidateName: { type: Type.STRING },
                        jobTitle: { type: Type.STRING },
                        reasoning: { type: Type.STRING },
                        suggestedSlots: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    date: { type: Type.STRING },
                                    time: { type: Type.STRING },
                                    timezone: { type: Type.STRING },
                                    probability: { type: Type.NUMBER }
                                },
                                required: ["date", "time", "timezone", "probability"]
                            }
                        }
                    },
                    required: ["candidateId", "candidateName", "jobTitle", "reasoning", "suggestedSlots"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        const result = JSON.parse(text) as InterviewScheduleSuggestion;
        return {
            ...result,
            candidateId: candidate.id,
            candidateName: candidate.name,
            jobTitle: job.title
        };
    } catch (error) {
        console.error("Error suggesting interview times:", error);
        throw new Error("Failed to suggest interview times with Gemini API.");
    }
};

// Candidate Tagging Types and Function
export interface CandidateTag {
    name: string;
    category: 'skill' | 'trait' | 'status' | 'potential';
    confidence: number;
}

export interface CandidateTagging {
    candidateId: string;
    candidateName: string;
    tags: CandidateTag[];
    smartFolders: string[];
    reasoning: string;
}

export const generateCandidateTags = async (candidate: Candidate): Promise<CandidateTagging> => {
    const candidateSkills = candidate.skills.join(', ');

    const prompt = `
    You are an AI Talent Categorization Expert. Analyze this candidate and suggest tags and smart folders.
    
    **Candidate:**
    - Name: ${candidate.name}
    - Skills: ${candidateSkills}
    - Type: ${candidate.type}
    
    **Task:**
    Generate:
    1. Tags (5-8 tags): skill-based, trait-based, status, potential
    2. Smart Folders (2-4 folders): categorizations like "Remote-Ready", "Leadership Potential", etc.
    3. Confidence score (0-100) for each tag
    
    Return structured JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        candidateId: { type: Type.STRING },
                        candidateName: { type: Type.STRING },
                        reasoning: { type: Type.STRING },
                        tags: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    category: { type: Type.STRING, enum: ["skill", "trait", "status", "potential"] },
                                    confidence: { type: Type.NUMBER }
                                },
                                required: ["name", "category", "confidence"]
                            }
                        },
                        smartFolders: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["candidateId", "candidateName", "reasoning", "tags", "smartFolders"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        const result = JSON.parse(text) as CandidateTagging;
        return {
            ...result,
            candidateId: candidate.id,
            candidateName: candidate.name
        };
    } catch (error) {
        console.error("Error generating candidate tags:", error);
        throw new Error("Failed to generate candidate tags with Gemini API.");
    }
};

// Pipeline Health Types and Function
export interface PipelineAlert {
    type: 'bottleneck' | 'risk' | 'opportunity' | 'urgent';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    affectedCandidates: string[];
    recommendation: string;
}

export interface PipelineMetrics {
    totalCandidates: number;
    avgTimeToHire: number;
    conversionRate: number;
    atRiskCount: number;
}

export interface PipelineHealthAnalysis {
    overallHealth: number;
    healthRating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    metrics: PipelineMetrics;
    alerts: PipelineAlert[];
    insights: string[];
    recommendations: string[];
}

export const analyzePipelineHealth = async (
    candidates: Candidate[],
    jobs: Job[]
): Promise<PipelineHealthAnalysis> => {
    const prompt = `
    You are a Pipeline Health Analyst. Analyze the recruiting pipeline and identify issues.
    
    **Pipeline Data:**
    - Total Candidates: ${candidates.length}
    - Total Open Positions: ${jobs.length}
    
    **Task:**
    Analyze and provide:
    1. Overall health score (0-100)
    2. Health rating (excellent/good/fair/poor/critical)
    3. Key metrics (avg time to hire, conversion rate, at-risk count)
    4. Alerts (bottlenecks, risks, opportunities, urgent items)
    5. Insights and recommendations
    
    Generate realistic pipeline analysis.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallHealth: { type: Type.NUMBER },
                        healthRating: { type: Type.STRING, enum: ["excellent", "good", "fair", "poor", "critical"] },
                        metrics: {
                            type: Type.OBJECT,
                            properties: {
                                totalCandidates: { type: Type.NUMBER },
                                avgTimeToHire: { type: Type.NUMBER },
                                conversionRate: { type: Type.NUMBER },
                                atRiskCount: { type: Type.NUMBER }
                            },
                            required: ["totalCandidates", "avgTimeToHire", "conversionRate", "atRiskCount"]
                        },
                        alerts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ["bottleneck", "risk", "opportunity", "urgent"] },
                                    severity: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    affectedCandidates: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    },
                                    recommendation: { type: Type.STRING }
                                },
                                required: ["type", "severity", "title", "description", "affectedCandidates", "recommendation"]
                            }
                        },
                        insights: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        recommendations: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["overallHealth", "healthRating", "metrics", "alerts", "insights", "recommendations"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        return JSON.parse(text) as PipelineHealthAnalysis;
    } catch (error) {
        console.error("Error analyzing pipeline health:", error);
        throw new Error("Failed to analyze pipeline health with Gemini API.");
    }
};

// Profile Refresh Types and Function
export interface ProfileChange {
    field: string;
    oldValue: string;
    newValue: string;
    significance: 'minor' | 'moderate' | 'major';
}

export interface RefreshedProfile {
    candidateId: string;
    candidateName: string;
    lastUpdated: string;
    changes: ProfileChange[];
    newSkills: string[];
    updatedExperience: string;
    promotions: string[];
    summary: string;
    impactAssessment: string;
}

export const refreshCandidateProfile = async (candidate: Candidate): Promise<RefreshedProfile> => {
    const currentProfile = {
        name: candidate.name,
        email: candidate.email,
        skills: candidate.skills,
        experience: candidate.experienceYears || 'Unknown'
    };

    const prompt = `
    You are an AI Profile Updater. Simulate refreshing this candidate's profile from LinkedIn/GitHub.
    
    **Current Profile:**
    ${JSON.stringify(currentProfile, null, 2)}
    
    **Task:**
    Simulate what a profile refresh might discover:
    1. New skills acquired (e.g., learned Python, React, AWS)
    2. Experience updates (promotions, new roles, increased years)
    3. Certifications or achievements
    4. Changed job titles or responsibilities
    
    Generate realistic updates that show professional growth.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        candidateId: { type: Type.STRING },
                        candidateName: { type: Type.STRING },
                        lastUpdated: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        impactAssessment: { type: Type.STRING },
                        updatedExperience: { type: Type.STRING },
                        changes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    field: { type: Type.STRING },
                                    oldValue: { type: Type.STRING },
                                    newValue: { type: Type.STRING },
                                    significance: { type: Type.STRING, enum: ["minor", "moderate", "major"] }
                                },
                                required: ["field", "oldValue", "newValue", "significance"]
                            }
                        },
                        newSkills: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        promotions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["candidateId", "candidateName", "lastUpdated", "summary", "impactAssessment", "changes", "newSkills", "updatedExperience", "promotions"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        const result = JSON.parse(text) as RefreshedProfile;
        return {
            ...result,
            candidateId: candidate.id,
            candidateName: candidate.name,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error refreshing candidate profile:", error);
        throw new Error("Failed to refresh candidate profile with Gemini API.");
    }
};

// Engagement Score Types and Function
export interface EngagementActivity {
    type: 'email_open' | 'link_click' | 'response' | 'profile_view' | 'application';
    timestamp: string;
    details: string;
}

export interface EngagementScore {
    candidateId: string;
    candidateName: string;
    score: number;
    level: 'hot' | 'warm' | 'cold';
    activities: EngagementActivity[];
    insights: string[];
    recommendation: string;
    lastInteraction: string;
}

export const calculateEngagementScore = async (candidate: Candidate): Promise<EngagementScore> => {
    const prompt = `
    You are an AI Engagement Analyst. Simulate tracking candidate engagement and interest level.
    
    **Candidate:**
    - Name: ${candidate.name}
    - Type: ${candidate.type}
    
    **Task:**
    Generate a realistic engagement profile showing:
    1. Simulated activities (email opens, link clicks, responses, profile views)
    2. Engagement score (0-100) based on activity level and recency
    3. Temperature level: hot (85-100), warm (50-84), cold (0-49)
    4. Behavioral insights
    5. Actionable recommendation
    
    Generate 3-6 realistic activities over the past 2 weeks.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        candidateId: { type: Type.STRING },
                        candidateName: { type: Type.STRING },
                        score: { type: Type.NUMBER },
                        level: { type: Type.STRING, enum: ["hot", "warm", "cold"] },
                        lastInteraction: { type: Type.STRING },
                        recommendation: { type: Type.STRING },
                        activities: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ["email_open", "link_click", "response", "profile_view", "application"] },
                                    timestamp: { type: Type.STRING },
                                    details: { type: Type.STRING }
                                },
                                required: ["type", "timestamp", "details"]
                            }
                        },
                        insights: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["candidateId", "candidateName", "score", "level", "lastInteraction", "recommendation", "activities", "insights"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        const result = JSON.parse(text) as EngagementScore;
        return {
            ...result,
            candidateId: candidate.id,
            candidateName: candidate.name
        };
    } catch (error) {
        console.error("Error calculating engagement score:", error);
        throw new Error("Failed to calculate engagement score with Gemini API.");
    }
};

// Training Recommendation Types and Function
export interface TrainingCourse {
    title: string;
    provider: string;
    duration: string;
    format: 'online' | 'in-person' | 'hybrid' | 'self-paced';
    cost: string;
    url?: string;
    relevance: number;
}

export interface SkillGap {
    skill: string;
    currentLevel: 'none' | 'beginner' | 'intermediate' | 'advanced';
    requiredLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedLearningTime: string;
}

export interface TrainingRecommendation {
    candidateId: string;
    candidateName: string;
    targetRole: string;
    skillGaps: SkillGap[];
    recommendedCourses: TrainingCourse[];
    learningPath: string[];
    estimatedTimeToReady: string;
    summary: string;
}

export const generateTrainingRecommendations = async (
    candidate: Candidate,
    job: Job
): Promise<TrainingRecommendation> => {
    const candidateSkills = candidate.skills;
    const requiredSkills = job.requiredSkills;

    const prompt = `
    You are an AI Learning & Development Advisor. Analyze skill gaps and recommend training.
    
    **Candidate Profile:**
    - Name: ${candidate.name}
    - Current Skills: ${candidateSkills.join(', ')}
    - Type: ${candidate.type}
    
    **Target Role:**
    - Title: ${job.title}
    - Required Skills: ${requiredSkills.join(', ')}
    - Department: ${job.department}
    
    **Task:**
    1. Identify skill gaps
    2. Assess current level vs. required level for each gap
    3. Prioritize gaps (critical, high, medium, low)
    4. Recommend specific courses/training programs
    5. Create a learning path
    6. Estimate time to become job-ready
    
    Return structured JSON with comprehensive training plan.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        candidateId: { type: Type.STRING },
                        candidateName: { type: Type.STRING },
                        targetRole: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        estimatedTimeToReady: { type: Type.STRING },
                        skillGaps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    skill: { type: Type.STRING },
                                    currentLevel: { type: Type.STRING, enum: ["none", "beginner", "intermediate", "advanced"] },
                                    requiredLevel: { type: Type.STRING, enum: ["beginner", "intermediate", "advanced", "expert"] },
                                    priority: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
                                    estimatedLearningTime: { type: Type.STRING }
                                },
                                required: ["skill", "currentLevel", "requiredLevel", "priority", "estimatedLearningTime"]
                            }
                        },
                        recommendedCourses: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    provider: { type: Type.STRING },
                                    duration: { type: Type.STRING },
                                    format: { type: Type.STRING, enum: ["online", "in-person", "hybrid", "self-paced"] },
                                    cost: { type: Type.STRING },
                                    url: { type: Type.STRING },
                                    relevance: { type: Type.NUMBER }
                                },
                                required: ["title", "provider", "duration", "format", "cost", "relevance"]
                            }
                        },
                        learningPath: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["candidateId", "candidateName", "targetRole", "summary", "estimatedTimeToReady", "skillGaps", "recommendedCourses", "learningPath"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        const result = JSON.parse(text) as TrainingRecommendation;
        return {
            ...result,
            candidateId: candidate.id,
            candidateName: candidate.name,
            targetRole: job.title
        };
    } catch (error) {
        console.error("Error generating training recommendations:", error);
        throw new Error("Failed to generate training recommendations with Gemini API.");
    }
};

// Interview Notes Summarizer Types and Function
export interface InterviewSummary {
    candidateId: string;
    candidateName: string;
    jobTitle: string;
    interviewDate: string;
    interviewer: string;
    strengths: string[];
    concerns: string[];
    keyTakeaways: string[];
    technicalAssessment: {
        rating: number;
        notes: string;
    };
    culturalFit: {
        rating: number;
        notes: string;
    };
    verdict: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
    nextSteps: string[];
    overallSummary: string;
}

export const summarizeInterviewNotes = async (
    rawNotes: string,
    candidateName: string,
    jobTitle: string,
    interviewer: string
): Promise<InterviewSummary> => {
    const prompt = `
    You are an expert Interview Notes Analyst. Transform messy, unstructured interview notes into a professional, standardized summary.
    
    **Raw Interview Notes:**
    ${rawNotes}
    
    **Context:**
    - Candidate: ${candidateName}
    - Position: ${jobTitle}
    - Interviewer: ${interviewer}
    
    **Task:**
    Extract and organize: Strengths, Concerns, Key Takeaways, Technical Assessment (1-10), Cultural Fit (1-10), Verdict, Next Steps, Overall Summary.
    
    Return structured JSON with comprehensive interview analysis.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        candidateId: { type: Type.STRING },
                        candidateName: { type: Type.STRING },
                        jobTitle: { type: Type.STRING },
                        interviewDate: { type: Type.STRING },
                        interviewer: { type: Type.STRING },
                        overallSummary: { type: Type.STRING },
                        verdict: {
                            type: Type.STRING,
                            enum: ["strong_yes", "yes", "maybe", "no", "strong_no"]
                        },
                        strengths: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        concerns: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        keyTakeaways: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        technicalAssessment: {
                            type: Type.OBJECT,
                            properties: {
                                rating: { type: Type.NUMBER },
                                notes: { type: Type.STRING }
                            },
                            required: ["rating", "notes"]
                        },
                        culturalFit: {
                            type: Type.OBJECT,
                            properties: {
                                rating: { type: Type.NUMBER },
                                notes: { type: Type.STRING }
                            },
                            required: ["rating", "notes"]
                        },
                        nextSteps: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["candidateId", "candidateName", "jobTitle", "interviewDate", "interviewer", "overallSummary", "verdict", "strengths", "concerns", "keyTakeaways", "technicalAssessment", "culturalFit", "nextSteps"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        const result = JSON.parse(text) as InterviewSummary;
        return {
            ...result,
            candidateName,
            jobTitle,
            interviewer,
            interviewDate: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error summarizing interview notes:", error);
        throw new Error("Failed to summarize interview notes with Gemini API.");
    }
};

// Email Template Personalization Types and Function
export interface PersonalizedEmail {
    subject: string;
    body: string;
    tone: 'professional' | 'friendly' | 'formal' | 'encouraging';
    personalizedElements: string[];
}

export const personalizeEmailTemplate = async (
    templateType: 'rejection_skills_gap' | 'rejection_experience' | 'rejection_culture_fit' | 'offer' | 'follow_up' | 'interview_invitation' | 'thank_you',
    candidate: Candidate,
    job: Job,
    additionalContext?: string
): Promise<PersonalizedEmail> => {
    const candidateSkills = candidate.skills.join(', ');
    const requiredSkills = job.requiredSkills.join(', ');

    const templateDescriptions = {
        rejection_skills_gap: 'Polite rejection email explaining the candidate lacks specific technical skills for the role',
        rejection_experience: 'Polite rejection email explaining the candidate needs more experience',
        rejection_culture_fit: 'Polite rejection email explaining the role wasn\'t the right fit',
        offer: 'Enthusiastic job offer email with next steps',
        follow_up: 'Friendly follow-up email to check candidate interest',
        interview_invitation: 'Professional interview invitation with scheduling details',
        thank_you: 'Appreciative thank you email after interview'
    };

    const prompt = `
    You are an expert Recruitment Communication Specialist. Generate a personalized email for a candidate.
    
    **Template Type:** ${templateType}
    **Description:** ${templateDescriptions[templateType]}
    
    **Candidate Information:**
    - Name: ${candidate.name}
    - Email: ${candidate.email}
    - Skills: ${candidateSkills}
    
    **Job Information:**
    - Title: ${job.title}
    - Department: ${job.department}
    - Required Skills: ${requiredSkills}
    
    ${additionalContext ? `**Additional Context:** ${additionalContext}` : ''}
    
    **Requirements:**
    1. Personalize with candidate's name and specific details
    2. For rejections: Be empathetic, specific about gaps, encourage future applications
    3. For offers: Be enthusiastic and clear about next steps
    4. Keep professional but warm tone
    
    Return structured JSON with subject, body, tone, and personalized elements.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        subject: { type: Type.STRING },
                        body: { type: Type.STRING },
                        tone: {
                            type: Type.STRING,
                            enum: ["professional", "friendly", "formal", "encouraging"]
                        },
                        personalizedElements: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["subject", "body", "tone", "personalizedElements"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");

        return JSON.parse(text) as PersonalizedEmail;
    } catch (error) {
        console.error("Error personalizing email template:", error);
        throw new Error("Failed to personalize email template with Gemini API.");
    }
};
