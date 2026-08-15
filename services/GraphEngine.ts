import { GraphNode, GraphEdge, NodeType, EdgeType } from '../types/graph';
import { SKILL_NODES, SKILL_ADJACENCY_EDGES } from '../data/skillsOntology';
import { Candidate, Job } from '../types';

export class GraphEngine {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: GraphEdge[] = [];

    constructor() {
        this.initializeOntology();
    }

    // Load the hardcoded ontology
    private initializeOntology() {
        SKILL_NODES.forEach(node => this.addNode(node));
        SKILL_ADJACENCY_EDGES.forEach(edge => this.addEdge(edge));
    }

    public addNode(node: GraphNode) {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
        }
    }

    public addEdge(edge: GraphEdge) {
        // Avoid duplicates
        const exists = this.edges.some(e =>
            e.source === edge.source &&
            e.target === edge.target &&
            e.type === edge.type
        );
        if (!exists) {
            this.edges.push(edge);
        }
    }

    // Helper to normalize strings for ID generation
    private normalize(str: string): string {
        return str.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    // --- Data Ingestion ---

    public ingestCandidate(candidate: Candidate) {
        const talentNodeId = `talent_${candidate.id}`;

        // 1. Create Talent Node
        this.addNode({
            id: talentNodeId,
            type: 'TALENT',
            label: candidate.name,
            data: candidate
        });

        // 2. Link Skills
        candidate.skills.forEach(skillName => {
            const skillId = `skill_${this.normalize(skillName)}`;

            // Ensure skill node exists (if not in ontology, create ad-hoc)
            if (!this.nodes.has(skillId)) {
                this.addNode({ id: skillId, type: 'SKILL', label: skillName });
            }

            this.addEdge({
                source: talentNodeId,
                target: skillId,
                type: 'HAS_SKILL',
                weight: 1.0 // Direct claim = 1.0 confidence
            });
        });

        // 3. Link Location (Mock)
        // In a real app, strict location entities would be used.
        // Here we'll just check if they have a 'location' field if we added one to Candidate, 
        // but for now we'll skip unless we update the Candidate type.
    }

    public ingestJob(job: Job) {
        const roleNodeId = `role_${job.id}`;

        // 1. Create Role Node
        this.addNode({
            id: roleNodeId,
            type: 'ROLE',
            label: job.title,
            data: job
        });

        // 2. Link Required Skills
        job.requiredSkills.forEach(skillName => {
            const skillId = `skill_${this.normalize(skillName)}`;

            // Ensure skill node exists
            if (!this.nodes.has(skillId)) {
                this.addNode({ id: skillId, type: 'SKILL', label: skillName });
            }

            this.addEdge({
                source: roleNodeId,
                target: skillId,
                type: 'REQUIRES_SKILL',
                weight: 1.0 // Mandatory requirement
            });
        });
    }

    // --- Querying ---

    public findRelatedSkills(skillName: string, minWeight: number = 0.5): { skill: string, weight: number }[] {
        const skillId = `skill_${this.normalize(skillName)}`;
        const neighbors = this.edges
            .filter(e => e.source === skillId && e.type === 'ADJACENT_TO' && e.weight >= minWeight)
            .map(e => ({
                skill: this.nodes.get(e.target)?.label || 'Unknown',
                weight: e.weight
            }));
        return neighbors;
    }

    public findTalentForRole(jobId: string): { candidateId: string, score: number, explanation: string[] }[] {
        const roleNodeId = `role_${jobId}`;
        if (!this.nodes.has(roleNodeId)) return [];

        // 1. Get Job Requirements
        const requiredSkillEdges = this.edges.filter(e => e.source === roleNodeId && e.type === 'REQUIRES_SKILL');
        const requiredSkillIds = requiredSkillEdges.map(e => e.target);

        const candidateScores = new Map<string, { score: number, matches: string[] }>();

        // 2. Traverse Graph
        requiredSkillIds.forEach(reqSkillId => {
            const reqSkillLabel = this.nodes.get(reqSkillId)?.label || reqSkillId;

            // A. Find candidates with DIRECT skill
            const directTalentEdges = this.edges.filter(e => e.target === reqSkillId && e.type === 'HAS_SKILL');

            directTalentEdges.forEach(edge => {
                const talentId = edge.source;
                const current = candidateScores.get(talentId) || { score: 0, matches: [] };
                current.score += 10; // High score for direct match
                current.matches.push(`Directly has ${reqSkillLabel}`);
                candidateScores.set(talentId, current);
            });

            // B. Find candidates with ADJACENT skills (The "Magic")
            // Find skills adjacent to the required skill
            const adjacentEdges = this.edges.filter(e => e.target === reqSkillId && e.type === 'ADJACENT_TO');

            adjacentEdges.forEach(adjEdge => {
                const adjacentSkillId = adjEdge.source; // Since adjacency is bi-directional in our data, check source
                const weight = adjEdge.weight;
                const adjacentSkillLabel = this.nodes.get(adjacentSkillId)?.label || adjacentSkillId;

                // Who has this adjacent skill?
                const adjacentTalentEdges = this.edges.filter(e => e.target === adjacentSkillId && e.type === 'HAS_SKILL');

                adjacentTalentEdges.forEach(tEdge => {
                    const talentId = tEdge.source;
                    // Verify they don't already have the direct skill (don't double count if they have both, or do? usually distinct)
                    // ideally checking if we already credited for this requirement. 
                    // Simplification: We add partial points.

                    const current = candidateScores.get(talentId) || { score: 0, matches: [] };
                    current.score += 10 * weight * 0.8; // Lower score for adjacent
                    current.matches.push(`Has adjacent skill: ${adjacentSkillLabel} (${(weight * 100).toFixed(0)}% correlation to ${reqSkillLabel})`);
                    candidateScores.set(talentId, current);
                });
            });
        });

        // 3. Format Results
        const results = Array.from(candidateScores.entries()).map(([talentId, data]) => ({
            candidateId: talentId.replace('talent_', ''),
            score: Math.min(100, Math.round(data.score / requiredSkillIds.length * 10)), // Normalize roughly
            explanation: [...new Set(data.matches)] // Dedup
        }));

        return results.sort((a, b) => b.score - a.score);
    }
}

// Singleton Instance
export const graphEngine = new GraphEngine();
