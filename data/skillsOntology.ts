import { GraphNode, GraphEdge } from '../types/graph';

// Domain: Pharma / Biotech / Manufacturing

export const SKILL_NODES: GraphNode[] = [
    // core
    { id: 'skill_upstream', type: 'SKILL', label: 'Upstream Processing' },
    { id: 'skill_downstream', type: 'SKILL', label: 'Downstream Processing' },
    { id: 'skill_chromatography', type: 'SKILL', label: 'Chromatography' },
    { id: 'skill_protein_purification', type: 'SKILL', label: 'Protein Purification' },
    { id: 'skill_gmp', type: 'SKILL', label: 'GMP Documentation' },
    { id: 'skill_validation', type: 'SKILL', label: 'Process Validation' },
    { id: 'skill_automation', type: 'SKILL', label: 'Lab Automation' },
    { id: 'skill_python', type: 'SKILL', label: 'Python for Data Science' },
    { id: 'skill_bioreactor', type: 'SKILL', label: 'Bioreactor Operation' },
    { id: 'skill_filtration', type: 'SKILL', label: 'Filtration Technologies' },
    { id: 'skill_capa', type: 'SKILL', label: 'CAPA Management' },
    { id: 'skill_sop_writing', type: 'SKILL', label: 'SOP Writing' },

    // soft / leadership
    { id: 'skill_cross_functional', type: 'SKILL', label: 'Cross-functional Collaboration' },
    { id: 'skill_agile', type: 'SKILL', label: 'Agile Methodology' },
];

export const SKILL_ADJACENCY_EDGES: GraphEdge[] = [
    // Upstream related
    { source: 'skill_upstream', target: 'skill_bioreactor', type: 'ADJACENT_TO', weight: 0.9 },
    { source: 'skill_bioreactor', target: 'skill_upstream', type: 'ADJACENT_TO', weight: 0.9 },

    // Downstream related
    { source: 'skill_downstream', target: 'skill_protein_purification', type: 'ADJACENT_TO', weight: 0.95 },
    { source: 'skill_protein_purification', target: 'skill_downstream', type: 'ADJACENT_TO', weight: 0.95 },

    { source: 'skill_chromatography', target: 'skill_protein_purification', type: 'ADJACENT_TO', weight: 0.85 },
    { source: 'skill_protein_purification', target: 'skill_chromatography', type: 'ADJACENT_TO', weight: 0.85 },

    { source: 'skill_filtration', target: 'skill_downstream', type: 'ADJACENT_TO', weight: 0.8 },
    { source: 'skill_downstream', target: 'skill_filtration', type: 'ADJACENT_TO', weight: 0.8 },

    // Quality / Reg
    { source: 'skill_gmp', target: 'skill_sop_writing', type: 'ADJACENT_TO', weight: 0.9 },
    { source: 'skill_sop_writing', target: 'skill_gmp', type: 'ADJACENT_TO', weight: 0.9 },

    { source: 'skill_gmp', target: 'skill_validation', type: 'ADJACENT_TO', weight: 0.7 },
    { source: 'skill_validation', target: 'skill_gmp', type: 'ADJACENT_TO', weight: 0.7 },

    { source: 'skill_capa', target: 'skill_gmp', type: 'ADJACENT_TO', weight: 0.8 },
    { source: 'skill_gmp', target: 'skill_capa', type: 'ADJACENT_TO', weight: 0.8 },

    // Tech
    { source: 'skill_automation', target: 'skill_python', type: 'ADJACENT_TO', weight: 0.6 },
    { source: 'skill_python', target: 'skill_automation', type: 'ADJACENT_TO', weight: 0.6 },
];
