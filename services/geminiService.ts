import { GoogleGenAI, Type } from "@google/genai";
import type { Job, Candidate, UploadedCandidate, FitAnalysis, JobAnalysis, HiddenGemAnalysis, InternalCandidate, ProfileEnrichmentAnalysis } from '../types';

// Support both local development and Vercel deployment
const getApiKey = () => {
  // Try Vite environment variable first (Vercel will use this)
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // Fallback to process.env for backwards compatibility
  if (process.env.API_KEY) {
    return process.env.API_KEY;
  }
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  console.error("⚠️ API_KEY environment variable not set. AI features will not work.");
  console.error("Please add VITE_GEMINI_API_KEY to your .env.local file or Vercel environment variables.");
  return "";
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

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
                    skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of key skills, technologies, and competencies."},
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
                        keyResponsibilities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3-5 key responsibilities."},
                        idealCandidateProfile: { type: Type.STRING, description: "A 2-3 sentence summary of the ideal candidate profile."},
                        suggestedSearchKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 5-7 relevant keywords for sourcing candidates."},
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

export const analyzeFit = async (job: Job, candidate: Candidate): Promise<FitAnalysis> => {
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
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
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
        console.error("Error analyzing fit:", error);
        throw new Error("Failed to analyze fit with Gemini API.");
    }
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
                        gemRationale: { type: Type.STRING, description: "Overall 2-3 sentence explanation of why this candidate is a hidden gem for THIS job."},
                        transferableSkillsAnalysis: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    skill: { type: Type.STRING, description: "Identified transferable skill."},
                                    candidateEvidence: { type: Type.STRING, description: "Evidence of this skill from the candidate's profile."},
                                    relevanceToJob: { type: Type.STRING, description: "How this skill applies to the selected job."}
                                },
                                required: ["skill", "candidateEvidence", "relevanceToJob"],
                            },
                            description: "A list of 2-3 key transferable skills."
                        },
                        unconventionalFitRationale: { type: Type.STRING, description: "A short summary explaining the non-obvious aspects of this fit that make it compelling."}
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