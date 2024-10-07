
type ID = string | number
type NodeConstraint<Id extends ID> = { parent: Id | null }
type EdgeConstraint<Id extends ID> = { start: Id, end: Id }

// trying to think through how this taxonomy data is modelled.
// we could think of each layer as a graph of Nodes and Edges
// however each node has a single, special edge leading into its parent layer-graph
export type Graph<Id extends ID, N extends NodeConstraint<Id>, E extends EdgeConstraint<Id>> = {
    nodes: Record<ID, N>
    edges: ReadonlyArray<E>;
    parent: Graph<ID, N, E> | null;
}
// this is rather annoying though - and it does make it slow to follow edges from nodes, etc...
// perhaps a semantic graph (flatten the heirarchy!) would be more useful, and we could index incoming / outgoing edges?

type OpaqueGraph<Id extends ID> = Graph<Id, NodeConstraint<Id>, EdgeConstraint<Id>>;

export function numNodes<Id extends ID, G extends OpaqueGraph<Id>>(graph: G): number {
    return Object.keys(graph.nodes).length;
}
export function getNode<Id extends ID, N extends NodeConstraint<Id>>(graph: Graph<ID, N, EdgeConstraint<Id>>, id: ID | null): N | null | undefined {
    return id === null ? null : graph.nodes[id]
}
export function getParentGraph<Id extends ID, N extends NodeConstraint<Id>, E extends EdgeConstraint<Id>>(graph: Graph<Id, N, E>): Graph<Id, N, E> | null {
    return graph.parent;
}
export function visitEdges<Id extends ID, N extends NodeConstraint<Id>, E extends EdgeConstraint<Id>>(graph: Graph<Id, N, E>, visit: (e: E, start: N, end: N) => void) {
    graph.edges.forEach((edge: E) => {
        const { start, end } = edge;
        const s = getNode(graph, start);
        const e = getNode(graph, end);
        if (s && e) {
            visit(edge, s, e);
        }
    });
}
function getAncestor<ID extends string | number, N extends NodeConstraint<ID>, E extends EdgeConstraint<ID>>(id: ID, generationGap: number, graph: Graph<ID, N, E>) {
    if (generationGap < 0) {
        return null;
    }
    const node = getNode(graph, id);
    if (generationGap === 0 || !node) {
        return node;
    }
    if (node.parent && graph.parent) {
        getAncestor(node.parent, generationGap - 1, graph.parent);
    }
    return null;
}
export function childrenVisitAncestors<ID extends string | number, N extends NodeConstraint<ID>, E extends EdgeConstraint<ID>>(graph: Graph<ID, N, E>, generationGap: number, visit: (me: N, myParent: N | null) => void) {
    for (const id of Object.keys(graph.nodes) as ID[]) {
        const me = getNode(graph, id);
        if (me) {
            const parent = (me.parent && graph.parent) ? getAncestor(me.parent, generationGap - 1, graph.parent) : null
            visit(me, parent ?? null);
        }
    }
}
export function visitChildParentPairs<ID extends string | number, N extends NodeConstraint<ID>, E extends EdgeConstraint<ID>>(graph: Graph<ID, N, E>, visit: (me: N, myParent: N | null) => void) {
    return childrenVisitAncestors(graph, 1, visit);
}
function graphLayersAbove<ID extends string | number>(graph: OpaqueGraph<ID>): number {
    return graph.parent ? 1 + graphLayersAbove(graph.parent) : 0;
}
export function visitOldestAncestors<ID extends string | number, N extends NodeConstraint<ID>, E extends EdgeConstraint<ID>>(graph: Graph<ID, N, E>, visit: (me: N, myParent: N | null) => void) {
    return childrenVisitAncestors(graph, graphLayersAbove(graph), visit);
}
type TaxonomyEntry = { index: number, count: number, title: string, value: string, idx: number, parent: string | null }
// ok an example use case would be to fill in the buffers to animate between two layers of the taxonomy

