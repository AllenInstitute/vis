
type ID = string | number
type NodeConstraint<Id extends ID> = { parent: Id | null }
type EdgeConstraint<Id extends ID> = { start: Id, end: Id }

export type Graph<Id extends ID, N extends NodeConstraint<Id>, E extends EdgeConstraint<Id>> = {
    nodes: Record<ID, N>
    edges: ReadonlyArray<E>;
    parent: Graph<ID, N, E> | null;
}
type OpaqueGraph<Id extends ID> = Graph<Id, NodeConstraint<Id>, EdgeConstraint<Id>>;

export function numNodes<Id extends ID, G extends OpaqueGraph<Id>>(graph: G): number {
    return Object.keys(graph.nodes).length;
}
export function getNode<Id extends ID, N extends NodeConstraint<Id>>(graph: Graph<ID, N, EdgeConstraint<Id>>, id: ID | null): N | null | undefined {
    return id === null ? null : graph.nodes[id]
}

// traverse the nodes of a graph, and output all pairs of {node, node.parent}
// export function visitChildParentPairs<ID extends string | number, N extends { parent: ID | null }, E extends { start: ID, end: ID }>(graph: Graph<ID, N, E>, visit: (me: N, myParent: N | null) => void) {
//     for (const id of Object.keys(graph.nodes) as ID[]) {
//         const me = getNode(graph, id);
//         if (me) {
//             const parent = graph.parent ? getNode(graph.parent, me.parent ?? null) : null;
//             visit(me, parent ?? null);
//         }
//     }
// }
function getAncestor<ID extends string | number, N extends { parent: ID | null }, E extends { start: ID, end: ID }>(id: ID, gap: number, graph: Graph<ID, N, E>) {
    if (gap < 0) {
        return null;
    }
    const node = getNode(graph, id);
    if (gap === 0 || !node) {
        return node;
    }
    if (node.parent && graph.parent) {
        getAncestor(node.parent, gap - 1, graph.parent);
    }
    return null;
}
export function childrenVisitAncestors<ID extends string | number, N extends { parent: ID | null }, E extends { start: ID, end: ID }>(graph: Graph<ID, N, E>, generationGap: number, visit: (me: N, myParent: N | null) => void) {
    for (const id of Object.keys(graph.nodes) as ID[]) {
        const me = getNode(graph, id);
        if (me) {
            const parent = (me.parent && graph.parent) ? getAncestor(me.parent, generationGap - 1, graph.parent) : null
            visit(me, parent ?? null);
        }
    }
}
export function visitChildParentPairs<ID extends string | number, N extends { parent: ID | null }, E extends { start: ID, end: ID }>(graph: Graph<ID, N, E>, visit: (me: N, myParent: N | null) => void) {
    return childrenVisitAncestors(graph, 1, visit);
}
function graphLayersAbove<ID extends string | number>(graph: OpaqueGraph<ID>): number {
    return graph.parent ? 1 + graphLayersAbove(graph.parent) : 0;
}
export function visitOldestAncestors<ID extends string | number, N extends { parent: ID | null }, E extends { start: ID, end: ID }>(graph: Graph<ID, N, E>, visit: (me: N, myParent: N | null) => void) {
    return childrenVisitAncestors(graph, graphLayersAbove(graph), visit);
}
type TaxonomyEntry = { index: number, count: number, title: string, value: string, idx: number, parent: string | null }
// ok an example use case would be to fill in the buffers to animate between two layers of the taxonomy

