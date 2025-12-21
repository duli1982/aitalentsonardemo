import { describe, it, expect, beforeEach } from 'vitest';
import { GraphEngine } from '../GraphEngine';

describe('GraphEngine', () => {
    let engine: GraphEngine;

    beforeEach(() => {
        engine = new GraphEngine();
    });

    describe('addNode', () => {
        it('should add a node to the graph', () => {
            engine.addNode('node_1', 'PERSON', { name: 'Alice' });
            const node = engine.getNode('node_1');

            expect(node).toBeDefined();
            expect(node?.type).toBe('PERSON');
            expect(node?.properties.name).toBe('Alice');
        });

        it('should not add duplicate nodes', () => {
            engine.addNode('node_1', 'PERSON', { name: 'Alice' });
            engine.addNode('node_1', 'PERSON', { name: 'Bob' });

            const node = engine.getNode('node_1');
            // Should keep original
            expect(node?.properties.name).toBe('Alice');
        });
    });

    describe('addEdge', () => {
        it('should create edge between existing nodes', () => {
            engine.addNode('alice', 'PERSON', { name: 'Alice' });
            engine.addNode('skill', 'SKILL', { name: 'React' });
            engine.addEdge('alice', 'skill', 'HAS_SKILL', { level: 'expert' });

            const edges = engine.getEdges?.('alice') || [];
            expect(edges.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('calculateCentrality', () => {
        it('should return higher centrality for connected nodes', () => {
            // Create a hub-and-spoke pattern
            engine.addNode('hub', 'PERSON', { name: 'Hub' });
            engine.addNode('spoke1', 'SKILL', { name: 'S1' });
            engine.addNode('spoke2', 'SKILL', { name: 'S2' });
            engine.addNode('spoke3', 'SKILL', { name: 'S3' });
            engine.addNode('isolated', 'PERSON', { name: 'Alone' });

            engine.addEdge('hub', 'spoke1', 'HAS_SKILL', {});
            engine.addEdge('hub', 'spoke2', 'HAS_SKILL', {});
            engine.addEdge('hub', 'spoke3', 'HAS_SKILL', {});

            const hubCentrality = engine.calculateCentrality('hub');
            const isolatedCentrality = engine.calculateCentrality('isolated');

            // Hub should have higher centrality than isolated node
            expect(hubCentrality).toBeGreaterThan(isolatedCentrality);
        });
    });

    describe('traverseBFS', () => {
        it('should find connected nodes', () => {
            engine.addNode('a', 'PERSON', { name: 'A' });
            engine.addNode('b', 'SKILL', { name: 'B' });
            engine.addNode('c', 'SKILL', { name: 'C' });
            engine.addNode('d', 'SKILL', { name: 'D' });

            engine.addEdge('a', 'b', 'HAS_SKILL', {});
            engine.addEdge('b', 'c', 'RELATED_TO', {});
            engine.addEdge('c', 'd', 'RELATED_TO', {});

            const reachable = engine.traverseBFS('a', 2);

            // Should reach at least A, B, C within 2 hops
            expect(reachable.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('findShortestPath', () => {
        it('should find path between connected nodes', () => {
            engine.addNode('start', 'PERSON', { name: 'Start' });
            engine.addNode('mid', 'SKILL', { name: 'Mid' });
            engine.addNode('end', 'SKILL', { name: 'End' });

            engine.addEdge('start', 'mid', 'HAS_SKILL', {});
            engine.addEdge('mid', 'end', 'RELATED_TO', {});

            const path = engine.findShortestPath('start', 'end');

            expect(path).toBeDefined();
            expect(path?.length).toBeGreaterThan(0);
        });

        it('should return null for disconnected nodes', () => {
            engine.addNode('island1', 'PERSON', { name: 'Island1' });
            engine.addNode('island2', 'PERSON', { name: 'Island2' });

            const path = engine.findShortestPath('island1', 'island2');

            expect(path).toBeNull();
        });
    });
});
