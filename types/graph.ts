// Graph Types
export type NodeType = 'TALENT' | 'SKILL' | 'ROLE' | 'PROJECT' | 'LOCATION';
export type EdgeType = 'HAS_SKILL' | 'WORKED_ON' | 'LOCATED_IN' | 'APPLIED_FOR' | 'REQUIRES_SKILL' | 'ADJACENT_TO' | 'REPORTED_TO';

export interface GraphNode {
    id: string;
    type: NodeType;
    label: string;
    data?: any; // Flexible data packet to hold specific entity details
}

export interface GraphEdge {
    source: string;
    target: string;
    type: EdgeType;
    weight: number; // 0.0 to 1.0
    metadata?: any;
}

export interface GraphPath {
    nodes: GraphNode[];
    edges: GraphEdge[];
    totalWeight: number;
}
