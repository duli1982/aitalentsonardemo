import { GoogleGenAI, Type } from "@google/genai";
import type { Job, Candidate, UploadedCandidate, FitAnalysis, JobAnalysis, HiddenGemAnalysis, InternalCandidate, ProfileEnrichmentAnalysis, InterviewGuide } from '../types';

// Get Gemini API key from Vite environment
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("VITE_GEMINI_API_KEY environment variable not set. Please add it to your .env file.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || '' });

function isGeminiConfigured(): boolean {
    return Boolean(GEMINI_API_KEY);
}

export const generateText = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating text:", error);
        throw new Error("Failed to generate text from Gemini API.");
    }
};

export const summarizeCandidateProfile = async (candidate: Candidate): Promise<string> => {
    const candidateInfo = candidate.type === 'uploaded'
        ? candidate.summary
        : candidate.type === 'internal'
            ? `Current Role: ${candidate.currentRole}. Career Aspirations: ${candidate.careerAspirations}`
            : candidate.notes;

    const prompt = `Based on the following candidate profile, generate a concise, 2-3 sentence professional summary suitable for a recruiter's overview.

Candidate Profile:
- Name: ${candidate.name}
- Type: ${candidate.type}
- Skills: ${candidate.skills.join(', ')}
- Profile Info: ${candidateInfo}

Generate the summary directly, without any introductory phrases.`;

    return generateText(prompt);
};

export const parseCvContent = async (fileContent: string, mimeType: string, fileName: string): Promise<UploadedCandidate> => {
    const filePart = {
        inlineData: {
            data: fileContent,
            mimeType: mimeType,
        },
    };

    const textPart = {
        text: "You are an expert HR assistant parsing a CV. Extract the information from the attached file and return a single JSON object with the candidate's details."
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "The full name of the candidate." },
                        email: { type: Type.STRING, description: "The candidate's email address." },
                        skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of key skills, technologies, and competencies." },
                        experienceYears: { type: Type.NUMBER, description: "An estimated total number of years of professional experience." },
                        summary: { type: Type.STRING, description: "A 2-3 sentence summary of the candidate's professional profile." },
                    },
                    required: ["name", "email", "skills", "experienceYears", "summary"],
                },
            },
        });

        const parsedJson = JSON.parse(response.text);

        return {
            ...parsedJson,
            id: `upl-${Date.now()}`,
            type: 'uploaded',
            fileName,
        } as UploadedCandidate;
    } catch (error) {
        console.error("Error parsing CV content:", error);
        throw new Error("Failed to parse CV with Gemini API.");
    }
};

export const enrichCandidateProfile = async (candidate: Candidate): Promise<ProfileEnrichmentAnalysis> => {
    const prompt = `You are an expert AI Talent Analyst. Based on the following partial candidate profile, enrich it by inferring missing information.
    
Candidate Profile:
- Name: ${candidate.name}
- Known Skills: ${candidate.skills.join(', ') || 'None specified'}
- Notes/Aspirations: ${candidate.type === 'internal' ? candidate.careerAspirations : candidate.type === 'past' ? candidate.notes : 'N/A'}

Your tasks:
1.  **Suggest a Role Title:** Based on their skills, infer a likely professional title (e.g., "Full-Stack Developer", "Project Coordinator").
2.  **Create an Experience Summary:** Write a concise, 2-3 sentence professional summary highlighting their likely strengths and experience level.
3.  **Infer Related Skills:** Based on their known skills, suggest 3-5 additional skills they might possess. For example, if they know React, they might also know CSS and HTML.

Return a single JSON object with your analysis.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestedRoleTitle: { type: Type.STRING, description: "An inferred, likely job title for the candidate." },
                        experienceSummary: { type: Type.STRING, description: "A 2-3 sentence professional summary based on available data." },
                        inferredSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3-5 related skills the candidate likely possesses." },
                    },
                    required: ["suggestedRoleTitle", "experienceSummary", "inferredSkills"],
                },
            },
        });
        return JSON.parse(response.text) as ProfileEnrichmentAnalysis;
    } catch (error) {
        console.error("Error enriching candidate profile:", error);
        throw new Error("Failed to enrich profile with Gemini API.");
    }
};

export const analyzeJob = async (job: Job): Promise<JobAnalysis> => {
    const { industry, companySize, reportingStructure, roleContextNotes } = job.companyContext || {};
    const prompt = `You are a world-class AI Talent Analyst. Analyze the following job description with the provided company context to generate a deep, structured summary. Your analysis must go beyond keywords to understand the role's true nature.

Job Title: ${job.title}
Job Description: ${job.description}

Company & Role Context:
- Industry: ${industry || 'Not specified'}
- Company Size: ${companySize || 'Not specified'}
- Reporting Structure: ${reportingStructure || 'Not specified'}
- Internal Role Notes: ${roleContextNotes || 'None'}

Based on all the information, provide a JSON response. For 'skillRequirements', analyze the description to differentiate between what is a core, non-negotiable requirement ('must-have') and what is a preference or bonus ('nice-to-have').`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        keyResponsibilities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3-5 key responsibilities." },
                        idealCandidateProfile: { type: Type.STRING, description: "A 2-3 sentence summary of the ideal candidate profile." },
                        suggestedSearchKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 5-7 relevant keywords for sourcing candidates." },
                        trueSeniorityLevel: { type: Type.STRING, description: "The true seniority level of the role (e.g., Junior, Mid-level, Senior, Staff, Principal) based on the full context." },
                        seniorityRationale: { type: Type.STRING, description: "A brief explanation for the determined seniority level." },
                        growthPathways: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 2-3 logical next-step roles for a person in this position." },
                        skillRequirements: {
                            type: Type.ARRAY,
                            description: "A detailed breakdown of required skills, differentiating between essential and desired.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    skill: { type: Type.STRING, description: "The name of the skill or technology." },
                                    level: { type: Type.STRING, description: "The level of requirement. Must be either 'must-have' or 'nice-to-have'." },
                                    rationale: { type: Type.STRING, description: "Brief rationale for why this skill is needed and its importance level." }
                                },
                                required: ["skill", "level", "rationale"]
                            }
                        }
                    },
                    required: ["keyResponsibilities", "idealCandidateProfile", "suggestedSearchKeywords", "trueSeniorityLevel", "seniorityRationale", "growthPathways", "skillRequirements"],
                },
            },
        });
        return JSON.parse(response.text) as JobAnalysis;
    } catch (error) {
        console.error("Error analyzing job:", error);
        throw new Error("Failed to analyze job with Gemini API.");
    }
};

type AnalyzeFitOptions = {
    model?: string;
    maxRetries?: number;
};

const DEFAULT_FIT_MODEL =
    // Prefer flash by default to avoid requiring paid quota.
    // Can be overridden via Vite env var: `VITE_GEMINI_FIT_MODEL=gemini-2.5-pro`
    ((import.meta as any)?.env?.VITE_GEMINI_FIT_MODEL as string | undefined) ?? "gemini-2.5-flash";

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryDelayMs(error: unknown): number | null {
    const message = (error as any)?.message;
    if (typeof message !== "string") return null;

    // Example: ..."retryDelay":"22s"...
    const match = message.match(/"retryDelay"\s*:\s*"(\d+)s"/);
    if (!match) return null;

    const seconds = Number(match[1]);
    if (!Number.isFinite(seconds)) return null;
    return Math.max(0, seconds * 1000);
}

function is429(error: unknown): boolean {
    const anyErr = error as any;
    if (anyErr?.status === 429) return true;
    const message = anyErr?.message;
    return typeof message === "string" && (message.includes("\"code\":429") || message.includes("429 (Too Many Requests)") || message.includes("RESOURCE_EXHAUSTED"));
}

export const analyzeFit = async (job: Job, candidate: Candidate, options: AnalyzeFitOptions = {}): Promise<FitAnalysis> => {
    const candidateSummary = candidate.type === 'uploaded' ? candidate.summary : candidate.type === 'internal' ? `Current Role: ${(candidate as InternalCandidate).currentRole}. Career Aspirations: ${(candidate as InternalCandidate).careerAspirations}. Dev Goals: ${(candidate as InternalCandidate).developmentGoals}. Perf Rating: ${(candidate as InternalCandidate).performanceRating}/5. Learning Agility: ${(candidate as InternalCandidate).learningAgility}/5.` : candidate.notes;
    const internalInfo = candidate.type === 'internal'
        ? `\n- Current Role: ${(candidate as InternalCandidate).currentRole}\n- Career Aspirations: ${(candidate as InternalCandidate).careerAspirations}\n- Learning Agility Score (1-5): ${(candidate as InternalCandidate).learningAgility}`
        : '';

    const prompt = `You are an expert AI talent analyst specializing in multi-dimensional candidate assessment. Your analysis must be deep, contextual, and go far beyond simple keyword matching.

Analyze the fit between the candidate's profile and the job description by evaluating five key dimensions:
1.  **Technical Skill Alignment**: Direct match of skills and technologies.
2.  **Transferable Skill Mapping**: Identify non-obvious skills that apply. (e.g., negotiation skills from sales for a partnerships role).
3.  **Career Stage Alignment (Growth Vector)**: Assess if this role is a logical next step. Do they have the foundation to learn and grow into it? Is their seniority appropriate?
4.  **Learning Agility Indicators**: Look for signs of adaptability, quick learning, and success in new environments or industries. For internal candidates, a high 'Learning Agility Score' is a strong positive signal.
5.  **Team Fit Signals**: Based on the candidate's background and job context (e.g., fast-paced SaaS), infer potential team fit.

**Candidate Profile:**
- Name: ${candidate.name}
- Type: ${candidate.type}
- Skills: ${candidate.skills.join(', ')}
- Summary/Notes/Aspirations: ${candidateSummary}${internalInfo}

**Job Description & Context:**
- Title: ${job.title}
- Required Skills: ${job.requiredSkills.join(', ')}
- Description: ${job.description}
- Company Context: Industry: ${job.companyContext?.industry}, Size: ${job.companyContext?.companySize}, Notes: ${job.companyContext?.roleContextNotes}

**Instructions:**
Provide a JSON response.
- For each of the five dimensions in \`multiDimensionalAnalysis\`, provide a score (0-100) and a concise, insightful rationale.
- Calculate a final, weighted \`matchScore\` (0-100) based on your holistic analysis of all dimensions.
- Provide an overall \`matchRationale\` summarizing the fit.
- Also include a list of key \`strengths\` and potential \`gaps\`.
- Provide a detailed \`skillGapAnalysis\` for each required job skill.
- Include a \`futurePotentialProjection\`.`;
    const model = options.model ?? DEFAULT_FIT_MODEL;
    const maxRetries = options.maxRetries ?? 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            matchScore: { type: Type.NUMBER, description: "A final, weighted score from 0 to 100 representing the overall fit." },
                            matchRationale: { type: Type.STRING, description: "A detailed 3-4 sentence explanation for the overall score." },
                            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 2-3 key strengths for this role." },
                            gaps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 1-2 potential gaps to probe in an interview." },
                            skillGapAnalysis: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        skill: { type: Type.STRING },
                                        candidateProficiency: { type: Type.NUMBER },
                                        rationale: { type: Type.STRING }
                                    },
                                    required: ["skill", "candidateProficiency", "rationale"]
                                }
                            },
                            futurePotentialProjection: {
                                type: Type.OBJECT,
                                properties: {
                                    suggestedFutureRole: { type: Type.STRING },
                                    estimatedTimeframe: { type: Type.STRING },
                                    potentialScore: { type: Type.NUMBER },
                                    rationale: { type: Type.STRING }
                                },
                                required: ["suggestedFutureRole", "estimatedTimeframe", "potentialScore", "rationale"]
                            },
                            multiDimensionalAnalysis: {
                                type: Type.OBJECT,
                                description: "A breakdown of the candidate's fit across five key dimensions.",
                                properties: {
                                    technicalSkillAlignment: {
                                        type: Type.OBJECT,
                                        properties: { score: { type: Type.NUMBER }, rationale: { type: Type.STRING } },
                                        required: ["score", "rationale"]
                                    },
                                    transferableSkillMapping: {
                                        type: Type.OBJECT,
                                        properties: { score: { type: Type.NUMBER }, rationale: { type: Type.STRING } },
                                        required: ["score", "rationale"]
                                    },
                                    careerStageAlignment: {
                                        type: Type.OBJECT,
                                        properties: { score: { type: Type.NUMBER }, rationale: { type: Type.STRING } },
                                        required: ["score", "rationale"]
                                    },
                                    learningAgilityIndicators: {
                                        type: Type.OBJECT,
                                        properties: { score: { type: Type.NUMBER }, rationale: { type: Type.STRING } },
                                        required: ["score", "rationale"]
                                    },
                                    teamFitSignals: {
                                        type: Type.OBJECT,
                                        properties: { score: { type: Type.NUMBER }, rationale: { type: Type.STRING } },
                                        required: ["score", "rationale"]
                                    }
                                },
                                required: ["technicalSkillAlignment", "transferableSkillMapping", "careerStageAlignment", "learningAgilityIndicators", "teamFitSignals"]
                            }
                        },
                        required: ["matchScore", "matchRationale", "strengths", "gaps", "skillGapAnalysis", "futurePotentialProjection", "multiDimensionalAnalysis"],
                    },
                },
            });

            return JSON.parse(response.text) as FitAnalysis;
        } catch (error) {
            if (attempt < maxRetries && is429(error)) {
                const retryDelayMs = parseRetryDelayMs(error) ?? Math.min(30_000, 1000 * Math.pow(2, attempt));
                console.warn(`[geminiService] analyzeFit rate-limited (model=${model}); retrying in ${Math.round(retryDelayMs / 1000)}s...`);
                await sleep(retryDelayMs);
                continue;
            }

            console.error("Error analyzing fit:", error);
            if (is429(error)) {
                throw new Error(`Gemini quota/rate-limit exceeded for model "${model}". Try again later, switch to "gemini-2.5-flash", or enable billing.`);
            }
            throw new Error("Failed to analyze fit with Gemini API.");
        }
    }

    throw new Error("Failed to analyze fit with Gemini API.");
};

export const analyzeHiddenGem = async (job: Job, candidate: Candidate): Promise<HiddenGemAnalysis> => {
    const candidateSummary = candidate.type === 'uploaded' ? candidate.summary : candidate.type === 'internal' ? candidate.careerAspirations : candidate.notes;
    const prompt = `You are an AI Talent Analyst specializing in identifying "Hidden Gems". Analyze why the candidate, marked as a Hidden Gem, is a strong, unconventional fit for the job. Focus on transferable skills and potential, not just direct skill matches.

Candidate Profile:
- Name: ${candidate.name}
- Skills: ${candidate.skills.join(', ')}
- Summary/Aspirations: ${candidateSummary}

Job Description:
- Title: ${job.title}
- Description: ${job.description}
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
                        gemRationale: { type: Type.STRING, description: "Overall 2-3 sentence explanation of why this candidate is a hidden gem for THIS job." },
                        transferableSkillsAnalysis: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    skill: { type: Type.STRING, description: "Identified transferable skill." },
                                    candidateEvidence: { type: Type.STRING, description: "Evidence of this skill from the candidate's profile." },
                                    relevanceToJob: { type: Type.STRING, description: "How this skill applies to the selected job." }
                                },
                                required: ["skill", "candidateEvidence", "relevanceToJob"],
                            },
                            description: "A list of 2-3 key transferable skills."
                        },
                        unconventionalFitRationale: { type: Type.STRING, description: "A short summary explaining the non-obvious aspects of this fit that make it compelling." }
                    },
                    required: ["gemRationale", "transferableSkillsAnalysis", "unconventionalFitRationale"],
                },
            },
        });
        return JSON.parse(response.text) as HiddenGemAnalysis;
    } catch (error) {
        console.error("Error analyzing hidden gem:", error);
        throw new Error("Failed to analyze hidden gem with Gemini API.");
    }
};


export const generateOutreachMessage = async (job: Job, candidate: Candidate): Promise<string> => {
    const candidateInfo = candidate.type === 'internal' ? `They are an internal employee whose aspirations include: "${(candidate as InternalCandidate).careerAspirations}".` : `They are a past applicant with these notes: "${candidate.type === 'past' ? candidate.notes : 'N/A'}".`;
    const prompt = `Generate a professional, personalized, and concise outreach message to ${candidate.name} for the role of ${job.title} at GBS Hungary.

Candidate's skills include: ${candidate.skills.join(', ')}.
${candidateInfo}
The job focuses on: ${job.description.substring(0, 200)}...

Keep the tone encouraging and inviting. Mention their potential fit and invite them to discuss the opportunity. Sign off as "GBS Hungary Talent Team".`;

    return generateText(prompt);
};

export interface ExtractedJobRequirements {
    suggestedTitle: string;
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    experienceLevel: string;
    keyResponsibilities: string[];
    suggestedDepartment: string;
    suggestedLocation: string;
    cleanedDescription: string;
}

export const extractJobRequirements = async (rawJobDescription: string): Promise<ExtractedJobRequirements> => {
    const prompt = `You are an expert HR AI assistant specializing in job description analysis. Analyze the following job description and extract the most critical requirements and information.

**Raw Job Description:**
${rawJobDescription}

**Your Task:**
Extract and structure the key information from this job description. Be intelligent about:
1. Identifying what are truly MUST-HAVE vs NICE-TO-HAVE skills
2. Determining realistic experience level (entry, junior, mid-level, senior, lead, principal)
3. Cleaning up the description to be professional and clear
4. Suggesting appropriate department and location if not explicitly stated

**Important Guidelines:**
- Must-have skills are truly critical - the candidate CANNOT succeed without them
- Nice-to-have skills would be beneficial but can be learned on the job
- Be realistic about experience levels - don't inflate requirements
- Focus on 5-10 most important skills total
- Extract 3-5 key responsibilities

Provide your analysis as a structured JSON response.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestedTitle: {
                            type: Type.STRING,
                            description: "A cleaned, professional job title based on the description"
                        },
                        mustHaveSkills: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 3-7 absolutely critical skills/requirements"
                        },
                        niceToHaveSkills: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 2-5 beneficial but not critical skills"
                        },
                        experienceLevel: {
                            type: Type.STRING,
                            description: "Required experience level: entry, junior, mid-level, senior, lead, or principal"
                        },
                        keyResponsibilities: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 3-5 main responsibilities for this role"
                        },
                        suggestedDepartment: {
                            type: Type.STRING,
                            description: "Suggested department (e.g., Engineering, Marketing, Sales, HR)"
                        },
                        suggestedLocation: {
                            type: Type.STRING,
                            description: "Suggested location (e.g., Remote, Budapest, Hybrid)"
                        },
                        cleanedDescription: {
                            type: Type.STRING,
                            description: "A professional, well-formatted version of the job description (2-4 paragraphs)"
                        }
                    },
                    required: [
                        "suggestedTitle",
                        "mustHaveSkills",
                        "niceToHaveSkills",
                        "experienceLevel",
                        "keyResponsibilities",
                        "suggestedDepartment",
                        "suggestedLocation",
                        "cleanedDescription"
                    ],
                },
            },
        });
        return JSON.parse(response.text) as ExtractedJobRequirements;
    } catch (error) {
        console.error("Error extracting job requirements:", error);
        throw new Error("Failed to extract job requirements with Gemini API.");
    }
};

export const generateInterviewGuide = async (job: Job, candidate: Candidate, fitAnalysis: FitAnalysis): Promise<InterviewGuide> => {
    const prompt = `You are an expert Technical Recruiter and Hiring Manager. Create a structured, custom interview guide for a candidate based on their fit analysis.
    
    **Context:**
    - Candidate: ${candidate.name}
    - Job: ${job.title}
    - Match Score: ${fitAnalysis.matchScore}/100
    - Key Gaps: ${fitAnalysis.gaps.join(', ')}
    - Key Strengths: ${fitAnalysis.strengths.join(', ')}
    
    **Goal:**
    Generate a set of interview questions that:
    1.  **Warm Up**: Build rapport.
    2.  **Probe Gaps**: Specifically target the identified weak spots to verify if they are true blockers.
    3.  **Validate Strengths**: Quickly confirm their strongest areas.
    4.  **Assess Cultural Fit**: Check alignment with the company context.
    
    **Output Format:**
    Return a JSON object with the following structure:
    {
      "candidateName": "${candidate.name}",
      "jobTitle": "${job.title}",
      "sections": [
        {
          "title": "Warm Up & Introduction",
          "questions": [
            { "question": "...", "rationale": "...", "expectedSignal": "..." }
          ]
        },
        ...
      ]
    }
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
                        candidateName: { type: Type.STRING },
                        jobTitle: { type: Type.STRING },
                        sections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    questions: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                question: { type: Type.STRING },
                                                rationale: { type: Type.STRING },
                                                expectedSignal: { type: Type.STRING }
                                            },
                                            required: ["question", "rationale", "expectedSignal"]
                                        }
                                    }
                                },
                                required: ["title", "questions"]
                            }
                        }
                    },
                    required: ["candidateName", "jobTitle", "sections"]
                }
            }
        });
        return JSON.parse(response.text) as InterviewGuide;
    } catch (error) {
        console.error("Error generating interview guide:", error);
        throw new Error("Failed to generate interview guide with Gemini API.");
    }
};

export interface FilterCriteria {
    skills?: string[];
    type?: 'internal' | 'past' | 'uploaded' | 'all';
    role?: string;
    minExperience?: number;
}

export const parseCandidateQuery = async (query: string): Promise<FilterCriteria> => {
    const prompt = `
    You are a recruiting assistant. Extract filter criteria from this natural language query: "${query}".
    Return ONLY a JSON object with these optional fields:
    - skills: array of strings (e.g. ["React", "Python"])
    - type: one of "internal", "past", "uploaded", "all" (default to "all" if not specified)
    - role: string (e.g. "Frontend Developer")
    - minExperience: number (years)

    Example: "Find me a senior frontend dev with React" -> {"role": "Frontend Developer", "skills": ["React"], "type": "all"}
    Example: "Internal candidates who know Python" -> {"type": "internal", "skills": ["Python"]}
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
                        skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                        type: { type: Type.STRING, enum: ["internal", "past", "uploaded", "all"] },
                        role: { type: Type.STRING },
                        minExperience: { type: Type.NUMBER }
                    },
                    required: []
                }
            }
        });

        const text = response.text;
        if (!text) return { type: 'all' };

        return JSON.parse(text) as FilterCriteria;
    } catch (error) {
        console.error("Error parsing query:", error);
        return { type: 'all' };
    }
};

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
    const prompt = `You are an AI Interview Scheduling Assistant. Suggest optimal interview times for ${candidate.name} for position ${job.title} in timezone ${interviewerTimezone}. Suggest 3 time slots for the next 7 days during business hours (9 AM - 5 PM). Avoid Mondays and Fridays. Return structured JSON.`;

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
        return { ...result, candidateId: candidate.id, candidateName: candidate.name, jobTitle: job.title };
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
    const prompt = `Analyze candidate ${candidate.name} with skills: ${candidate.skills.join(', ')}. Generate 5-8 tags (skill-based, trait-based, status, potential) and 2-4 smart folders. Return structured JSON.`;

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
        return { ...result, candidateId: candidate.id, candidateName: candidate.name };
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

export const analyzePipelineHealth = async (candidates: Candidate[], jobs: Job[]): Promise<PipelineHealthAnalysis> => {
    const prompt = `Analyze recruiting pipeline with ${candidates.length} candidates and ${jobs.length} open positions. Provide health score (0-100), metrics, alerts, insights and recommendations. Return structured JSON.`;

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
                                    affectedCandidates: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    recommendation: { type: Type.STRING }
                                },
                                required: ["type", "severity", "title", "description", "affectedCandidates", "recommendation"]
                            }
                        },
                        insights: { type: Type.ARRAY, items: { type: Type.STRING } },
                        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
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
    const prompt = `Simulate refreshing ${candidate.name}'s profile from LinkedIn/GitHub. Current skills: ${candidate.skills.join(', ')}. Generate realistic updates showing professional growth. Return structured JSON.`;

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
                        newSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                        promotions: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["candidateId", "candidateName", "lastUpdated", "summary", "impactAssessment", "changes", "newSkills", "updatedExperience", "promotions"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        const result = JSON.parse(text) as RefreshedProfile;
        return { ...result, candidateId: candidate.id, candidateName: candidate.name, lastUpdated: new Date().toISOString() };
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

type EngagementScoreOptions = {
    mode?: 'estimated' | 'ai';
    model?: string;
    maxRetries?: number;
};

function clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreToLevel(score: number): 'hot' | 'warm' | 'cold' {
    if (score >= 70) return 'hot';
    if (score >= 45) return 'warm';
    return 'cold';
}

function parseDate(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

function estimateEngagementScore(candidate: Candidate, note?: string): EngagementScore {
    const now = new Date();

    const lastContactDate = parseDate((candidate as any).lastContactDate);
    const uploadDate = parseDate((candidate as any).uploadDate);
    const lastInteractionDate = lastContactDate || uploadDate || now;
    const daysAgo = Math.max(0, Math.round((now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24)));

    let score = 50;

    if (daysAgo <= 2) score += 30;
    else if (daysAgo <= 7) score += 15;
    else if (daysAgo <= 14) score += 5;
    else if (daysAgo <= 30) score -= 10;
    else score -= 20;

    const employmentStatus = (candidate as any).employmentStatus as string | undefined;
    if (employmentStatus === 'available') score += 10;
    if (employmentStatus === 'passive') score -= 5;
    if (employmentStatus === 'interviewing') score += 5;

    const profileStatus = (candidate as any).profileStatus as string | undefined;
    if (profileStatus === 'complete') score += 5;
    if (profileStatus === 'partial') score += 2;
    if (profileStatus === 'placeholder') score -= 10;

    const learningAgility = Number((candidate as any).learningAgility);
    if (Number.isFinite(learningAgility)) score += Math.round((learningAgility - 3) * 4);

    const performanceRating = Number((candidate as any).performanceRating);
    if (Number.isFinite(performanceRating)) score += Math.round((performanceRating - 3) * 4);

    const finalScore = clampScore(score);
    const level = scoreToLevel(finalScore);

    const activities: EngagementActivity[] = [
        {
            type: 'profile_view',
            timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * Math.min(daysAgo, 14)).toISOString(),
            details: 'Profile viewed in Talent Sonar.'
        }
    ];

    if (finalScore >= 45) {
        activities.push({
            type: 'email_open',
            timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * Math.min(daysAgo + 1, 14)).toISOString(),
            details: 'Recent outreach email opened.'
        });
    }

    if (finalScore >= 70) {
        activities.push({
            type: 'response',
            timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
            details: 'Candidate responded quickly to outreach.'
        });
    }

    const insights: string[] = [];
    if (daysAgo <= 7) insights.push('Recent activity indicates responsiveness.');
    else insights.push('No recent activity; consider a fresh outreach.');

    if ((candidate.skills || []).length >= 5) insights.push('Profile is well populated with skills.');
    if (profileStatus === 'placeholder') insights.push('Profile appears incomplete; enrich profile before heavy outreach.');

    if (note) insights.unshift(note);

    const recommendation =
        level === 'hot'
            ? 'Prioritize outreach; propose interview slots.'
            : level === 'warm'
                ? 'Send a short, personalized message and follow up in 48h.'
                : 'Warm up with value-first outreach; retry later if no response.';

    return {
        candidateId: candidate.id,
        candidateName: candidate.name,
        score: finalScore,
        level,
        activities: activities.slice(0, 6),
        insights: insights.slice(0, 6),
        recommendation,
        lastInteraction: lastInteractionDate.toISOString()
    };
}

export const calculateEngagementScore = async (
    candidate: Candidate,
    options: EngagementScoreOptions = {}
): Promise<EngagementScore> => {
    const mode = options.mode ?? 'estimated';

    if (mode !== 'ai' || !isGeminiConfigured()) {
        return estimateEngagementScore(candidate, 'Estimated engagement (no tracking connected).');
    }

    const model = options.model ?? "gemini-2.5-flash";
    const maxRetries = options.maxRetries ?? 1;

    const prompt = `Generate engagement profile for ${candidate.name}. Simulate 3-6 activities (email opens, link clicks, responses) over past 2 weeks. Score 0-100 with level (hot/warm/cold). Return structured JSON.`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model,
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
                            insights: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["candidateId", "candidateName", "score", "level", "lastInteraction", "recommendation", "activities", "insights"]
                    }
                }
            });

            const text = response.text;
            if (!text) throw new Error("No response from AI");
            const result = JSON.parse(text) as EngagementScore;
            return { ...result, candidateId: candidate.id, candidateName: candidate.name };
        } catch (error) {
            if (attempt < maxRetries && is429(error)) {
                const retryDelayMs = parseRetryDelayMs(error) ?? Math.min(30_000, 1000 * Math.pow(2, attempt));
                console.warn(`[geminiService] calculateEngagementScore rate-limited (model=${model}); retrying in ${Math.round(retryDelayMs / 1000)}s...`);
                await sleep(retryDelayMs);
                continue;
            }

            console.error("Error calculating engagement score:", error);
            const note = is429(error)
                ? 'AI quota exceeded; showing estimated engagement.'
                : 'AI unavailable; showing estimated engagement.';
            return estimateEngagementScore(candidate, note);
        }
    }

    return estimateEngagementScore(candidate, 'AI unavailable; showing estimated engagement.');
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

export const generateTrainingRecommendations = async (candidate: Candidate, job: Job): Promise<TrainingRecommendation> => {
    const prompt = `Analyze skill gaps for ${candidate.name} (skills: ${candidate.skills.join(', ')}) for role ${job.title} (requires: ${job.requiredSkills.join(', ')}). Recommend courses and learning path. Return structured JSON.`;

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
                        learningPath: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["candidateId", "candidateName", "targetRole", "summary", "estimatedTimeToReady", "skillGaps", "recommendedCourses", "learningPath"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        const result = JSON.parse(text) as TrainingRecommendation;
        return { ...result, candidateId: candidate.id, candidateName: candidate.name, targetRole: job.title };
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

export const summarizeInterviewNotes = async (rawNotes: string, candidateName: string, jobTitle: string, interviewer: string): Promise<InterviewSummary> => {
    const prompt = `Transform messy interview notes into structured summary for ${candidateName} interviewing for ${jobTitle} by ${interviewer}. Extract: Strengths, Concerns, Technical Assessment (1-10), Cultural Fit (1-10), Verdict, Next Steps. Notes: ${rawNotes}`;

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
                        verdict: { type: Type.STRING, enum: ["strong_yes", "yes", "maybe", "no", "strong_no"] },
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        concerns: { type: Type.ARRAY, items: { type: Type.STRING } },
                        keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
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
                        nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["candidateId", "candidateName", "jobTitle", "interviewDate", "interviewer", "overallSummary", "verdict", "strengths", "concerns", "keyTakeaways", "technicalAssessment", "culturalFit", "nextSteps"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        const result = JSON.parse(text) as InterviewSummary;
        return { ...result, candidateName, jobTitle, interviewer, interviewDate: new Date().toISOString() };
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
    const templateDescriptions = {
        rejection_skills_gap: 'Polite rejection email explaining the candidate lacks specific technical skills',
        rejection_experience: 'Polite rejection email explaining the candidate needs more experience',
        rejection_culture_fit: 'Polite rejection email explaining the role wasn\'t the right fit',
        offer: 'Enthusiastic job offer email with next steps',
        follow_up: 'Friendly follow-up email to check candidate interest',
        interview_invitation: 'Professional interview invitation',
        thank_you: 'Appreciative thank you email after interview'
    };

    const prompt = `Generate personalized ${templateType} email for ${candidate.name} (skills: ${candidate.skills.join(', ')}) for ${job.title} role. ${additionalContext || ''}. Return subject, body, tone, and personalized elements as JSON.`;

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
                        tone: { type: Type.STRING, enum: ["professional", "friendly", "formal", "encouraging"] },
                        personalizedElements: { type: Type.ARRAY, items: { type: Type.STRING } }
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
