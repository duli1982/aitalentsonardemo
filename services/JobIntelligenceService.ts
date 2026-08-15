export type JobBoardProvider = 'greenhouse' | 'lever';
export type ExternalJobPosting = { provider: JobBoardProvider; external_job_id: string; title: string; department?: string; location?: string; apply_url?: string; posted_at?: string; last_seen_at: string; skills?: string[] };
const key = (organizationId: string) => `talentSonar:${organizationId}:externalJobs`;
const read = (organizationId: string): ExternalJobPosting[] => { try { const value = JSON.parse(localStorage.getItem(key(organizationId)) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const SKILL_DICTIONARY = ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Java', 'Python', 'SQL', 'AWS', 'Azure', 'GCP', 'Kubernetes', 'Terraform', 'DevOps', 'Selenium', 'Cypress', 'QA Automation', 'Project Management', 'Agile', 'Scrum', 'Marketing', 'Analytics', 'Tableau', 'Power BI', 'Machine Learning', 'Data Science', 'Human Resources', 'Compliance', 'Quality Assurance', 'Manufacturing'];
const inferSkills = (text: string) => SKILL_DICTIONARY.filter((skill) => text.toLowerCase().includes(skill.toLowerCase()));
export const jobIntelligenceService = {
  async sync(organizationId: string, provider: JobBoardProvider, boardToken: string): Promise<number> {
    const url = provider === 'greenhouse' ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs` : `https://api.lever.co/v0/postings/${encodeURIComponent(boardToken)}?mode=json`;
    const response = await fetch(url); if (!response.ok) throw new Error(`The ${provider} board could not be loaded.`); const payload = await response.json(); const raw = provider === 'greenhouse' ? payload.jobs : payload; const now = new Date().toISOString();
    const postings: ExternalJobPosting[] = (Array.isArray(raw) ? raw : []).map((job: any) => { const title = String(job.title || job.text || 'Untitled role'); const content = [title, job.content, job.descriptionPlain, job.description, job.categories?.commitment].filter(Boolean).join(' '); return { provider, external_job_id: String(job.id || job.hostedUrl || job.text), title, department: job.departments?.[0]?.name || job.categories?.team, location: job.location?.name || job.categories?.location, apply_url: job.absolute_url || job.hostedUrl, posted_at: job.updated_at || job.createdAt, last_seen_at: now, skills: inferSkills(content) }; });
    const existing = read(organizationId).filter((posting) => posting.provider !== provider);
    localStorage.setItem(key(organizationId), JSON.stringify([...postings, ...existing])); return postings.length;
  },
  async list(organizationId: string): Promise<ExternalJobPosting[]> { return read(organizationId); },
};
