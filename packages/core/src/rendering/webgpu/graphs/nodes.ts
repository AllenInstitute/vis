class GraphNode {
    constructor(
        public id: string,
        public type: string,
        public data: any,
        public children: GraphNode[] = []
    ) {}
}

/**
 * Merges two DAGs into a single DAG that preserves every ancestor-descendant
 * relationship present in either source graph.  Concretely, if node A is an
 * ancestor of node B in either input graph it will remain an ancestor of B in
 * the merged result.
 *
 * When the same node `id` appears in both graphs the first graph's `type` and
 * `data` are kept; edges from both graphs are unioned.
 *
 * @throws if the union of edges from both graphs contains a cycle, which
 *   means the two graphs impose contradictory ordering constraints and a
 *   consistent merge is impossible.
 *
 * @param rootsA - Root nodes of the first graph.
 * @param rootsB - Root nodes of the second graph.
 * @returns Root nodes of the merged graph (nodes with no incoming edges).
 */
function mergeGraphs(rootsA: GraphNode[], rootsB: GraphNode[]): GraphNode[] {
    // ------------------------------------------------------------------
    // Step 1 – Collect all unique nodes from both graphs.
    // A fresh `seen` set is used per graph so that a node shared between the
    // two graphs is fully traversed in both contexts (important when the node
    // has graph-specific children that live below it in only one graph).
    // ------------------------------------------------------------------
    const nodeMap = new Map<string, GraphNode>();

    function gatherNodes(roots: GraphNode[]): void {
        const seen = new Set<string>();
        function visit(node: GraphNode): void {
            if (seen.has(node.id)) return; // TODO: this should actually be an error, since it indicates that the input graph has a cycle
            seen.add(node.id);
            if (!nodeMap.has(node.id)) {
                // Children are intentionally omitted here; they are wired up
                // in Step 4 after the full edge union is known.
                nodeMap.set(node.id, new GraphNode(node.id, node.type, node.data));
            }
            for (const child of node.children) visit(child);
        }
        for (const root of roots) visit(root);
    }

    gatherNodes(rootsA);
    gatherNodes(rootsB);

    // ------------------------------------------------------------------
    // Step 2 – Build the union of directed edges from both graphs.
    // Again a per-graph `seen` set ensures that shared nodes contribute
    // their edges from both graphs even though they share the same id.
    // ------------------------------------------------------------------
    const edges = new Map<string, Set<string>>();

    function gatherEdges(roots: GraphNode[]): void {
        const seen = new Set<string>();
        function visit(node: GraphNode): void {
            if (seen.has(node.id)) return; // TODO: this should actually be an error, since it indicates that the input graph has a cycle
            seen.add(node.id);

            // TODO: will want to restructure this to avoid .get() for every child, maybe? want this to be as memory/cpu efficient as possible
            if (!edges.has(node.id)) edges.set(node.id, new Set());
            for (const child of node.children) {
                const childSet = edges.get(node.id);
                if (childSet) {
                    childSet.add(child.id);
                }
                visit(child);
            }
        }
        for (const root of roots) visit(root);
    }

    gatherEdges(rootsA);
    gatherEdges(rootsB);

    // ------------------------------------------------------------------
    // Step 3 – Topological sort via Kahn's algorithm.
    // Serves two purposes: produces a valid processing order AND detects
    // cycles.  A cycle in the union means the two graphs have contradictory
    // ordering constraints (A before B in one graph, B before A in the other).
    // ------------------------------------------------------------------
    const inDegree = new Map<string, number>();
    for (const id of nodeMap.keys()) inDegree.set(id, 0);

    for (const [, childIds] of edges) {
        for (const childId of childIds) {
            inDegree.set(childId, (inDegree.get(childId) ?? 0) + 1);
        }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    const topoOrder: string[] = [];
    while (queue.length > 0) {
        const id = queue.shift()!;
        topoOrder.push(id);
        for (const childId of edges.get(id) ?? []) {
            const newDeg = inDegree.get(childId)! - 1;
            inDegree.set(childId, newDeg);
            if (newDeg === 0) queue.push(childId);
        }
    }

    if (topoOrder.length !== nodeMap.size) {
        throw new Error(
            'Cannot merge graphs: the combined edge set contains a cycle. ' +
                'The two graphs impose contradictory ordering constraints.'
        );
    }

    // ------------------------------------------------------------------
    // Step 4 – Wire up children on the merged nodes using the combined edges.
    // ------------------------------------------------------------------
    // TODO: this is a problem: rather than potentially inserting nodes in between ancestors and descendants, this is just reconnecting
    // them, causing "gaps" in the traversal logic of the new graph
    for (const [parentId, childIds] of edges) {
        const parent = nodeMap.get(parentId)!;
        parent.children = [...childIds].map((id) => nodeMap.get(id)!);
    }

    // ------------------------------------------------------------------
    // Step 5 – Return root nodes (those that have no incoming edges).
    // ------------------------------------------------------------------
    const hasParent = new Set<string>();
    for (const [, childIds] of edges) {
        for (const childId of childIds) hasParent.add(childId);
    }

    return [...nodeMap.keys()].filter((id) => !hasParent.has(id)).map((id) => nodeMap.get(id)!);
}

/**
 * Merges a WebGPU Command Graph (CG) with a Bind Group Graph (BGG) to
 * produce a command hierarchy suitable for driving a GPURenderPassEncoder.
 *
 * ── Why this is different from mergeGraphs ─────────────────────────────
 *
 * mergeGraphs performs a topological union of edges: every node is shared
 * by ID and every edge from both graphs is preserved.  That strategy fails
 * for this domain in two ways:
 *
 *  1. Command ordering.  A plain edge union leaves BindGroup and Drawable
 *     nodes as unordered siblings under their Pipeline node.  WebGPU
 *     requires setBindGroup calls to precede draw calls in the encoded
 *     command stream.
 *
 *  2. Multiple pipeline occurrences.  The same Pipeline may be referenced
 *     from several points in the CG (each heading a distinct draw batch).
 *     In a shared-node DAG the Pipeline (and therefore its bind-group
 *     sub-tree) would be visited exactly once during traversal, so each
 *     later batch would never re-emit setBindGroup — producing incorrect
 *     GPU state.  Each occurrence must own an independent copy of the
 *     bind-group sub-tree so the encoder visits it the correct number of
 *     times.
 *
 * ── Join point ─────────────────────────────────────────────────────────
 *
 * The two graphs share Pipeline nodes as their only common node type:
 *
 *   BGG  ──  Pipeline → BindGroup(s) → Resource(s)
 *   CG   ──  … → Pipeline → Drawable(s) [ → other state commands ]
 *
 * For every Pipeline occurrence found during CG traversal the algorithm:
 *
 *   a. Clones the corresponding BGG sub-tree independently (one clone per
 *      CG occurrence) so that each pipeline occurrence is self-contained.
 *
 *   b. Identifies the leaf nodes of the cloned BGG sub-tree.  Leaves
 *      represent fully-specified bind-group states; Drawables placed there
 *      are guaranteed to fire after all ancestor setBindGroup calls.
 *
 *   c. Distributes the Drawable children of the CG Pipeline node across the
 *      appropriate BGG leaf nodes via the configurable `matchDrawablesToLeaf`
 *      callback (default: attach all Drawables to every leaf, which is
 *      correct when all draws under a pipeline share a single bind-group
 *      path).
 *
 *   d. Prepends any non-Drawable CG children of the Pipeline (viewport
 *      settings, scissor rects, etc.) before the BGG sub-tree so that
 *      general state commands are encoded before bind-group / draw commands.
 *
 * ── Efficiency preservation ────────────────────────────────────────────
 *
 * The BGG tree structure encodes the setBindGroup efficiency strategy: bind
 * groups shared across many draws sit high in the tree (set once per batch)
 * while per-draw bind groups sit at the leaves.  Cloning the sub-tree
 * wholesale preserves this structure verbatim, so no redundant setBindGroup
 * calls are introduced within a single pipeline batch.
 *
 * @param commandRoots   - Root nodes of the Command Graph.
 * @param bindGroupRoots - Root nodes of the Bind Group Graph.
 * @param options
 * @param options.pipelineType         - Node type string identifying Pipeline
 *                                       nodes (default: `'Pipeline'`).
 * @param options.drawableType         - Node type string identifying Drawable
 *                                       nodes (default: `'Drawable'`).
 * @param options.matchDrawablesToLeaf - Optional callback invoked for each
 *   leaf of the cloned BGG sub-tree.  Receives the leaf node and the full
 *   list of Drawable siblings from the CG; returns the subset to attach
 *   under that leaf.  Override when different Drawables require different
 *   bind-group states (i.e. when the BGG sub-tree has multiple leaves, each
 *   representing a distinct fully-specified configuration).
 *
 * @returns Root nodes of the merged graph.
 */
function mergeCommandAndBindGroupGraphs(
    commandRoots: GraphNode[],
    bindGroupRoots: GraphNode[],
    {
        pipelineType = 'Pipeline',
        drawableType = 'Drawable',
        matchDrawablesToLeaf = (_leaf: GraphNode, drawables: GraphNode[]) => drawables,
    }: {
        pipelineType?: string;
        drawableType?: string;
        matchDrawablesToLeaf?: (leaf: GraphNode, drawables: GraphNode[]) => GraphNode[];
    } = {}
): GraphNode[] {
    // ── Step 1 ─────────────────────────────────────────────────────────────
    // Index the BGG: for each Pipeline node record its direct children
    // (= the roots of its bind-group sub-tree).  One pass, DAG-safe.
    // ───────────────────────────────────────────────────────────────────────
    const bgSubtrees = new Map<string, GraphNode[]>();
    {
        const visited = new Set<string>();
        function indexBGG(node: GraphNode): void {
            if (visited.has(node.id)) return;
            visited.add(node.id);
            if (node.type === pipelineType) {
                bgSubtrees.set(node.id, node.children);
            }
            for (const child of node.children) indexBGG(child);
        }
        for (const root of bindGroupRoots) indexBGG(root);
    }

    // ── Step 2 ─────────────────────────────────────────────────────────────
    // Deep-clone a BGG sub-tree.
    //
    // Each CG occurrence of a pipeline needs its own independent copy.
    // If two CG contexts shared the same BGG sub-tree nodes, a traversal
    // that drives command encoding would only visit the bind-group nodes
    // once (whichever context was reached first), leaving the second
    // context without the required setBindGroup preamble.
    // ───────────────────────────────────────────────────────────────────────
    function cloneSubtree(node: GraphNode): GraphNode {
        return new GraphNode(node.id, node.type, node.data, node.children.map(cloneSubtree));
    }

    // ── Step 3 ─────────────────────────────────────────────────────────────
    // Collect the leaf nodes of an array of sub-tree roots.
    //
    // Leaves are the deepest bind-group nodes in the BGG sub-tree.
    // Drawable nodes appended here will always be reached after all
    // ancestor setBindGroup commands have been encoded.
    // ───────────────────────────────────────────────────────────────────────
    function collectLeaves(roots: GraphNode[]): GraphNode[] {
        const leaves: GraphNode[] = [];
        function walk(node: GraphNode): void {
            if (node.children.length === 0) {
                leaves.push(node);
            } else {
                for (const child of node.children) walk(child);
            }
        }
        for (const root of roots) walk(root);
        return leaves;
    }

    // ── Step 4 ─────────────────────────────────────────────────────────────
    // Traverse the CG and construct the merged graph.
    //
    // Non-pipeline nodes: built once and cached by ID (standard DAG
    //   semantics — multiple parents can safely share a single merged node).
    //
    // Pipeline nodes: NEVER cached.  A fresh GraphNode (with a freshly
    //   cloned BGG sub-tree) is created for every visit, which is what
    //   allows the same logical pipeline to appear multiple times in the
    //   merged output, each with its own independent bind-group preamble.
    // ───────────────────────────────────────────────────────────────────────
    const mergedCache = new Map<string, GraphNode>();

    function buildNode(node: GraphNode): GraphNode {
        if (node.type === pipelineType) {
            return buildPipelineNode(node);
        }

        if (mergedCache.has(node.id)) {
            return mergedCache.get(node.id)!;
        }

        const merged = new GraphNode(node.id, node.type, node.data);
        // Cache before recursing so that any (non-pipeline) diamond shapes
        // in the CG are handled without double-building.
        mergedCache.set(node.id, merged);
        merged.children = node.children.map(buildNode);
        return merged;
    }

    function buildPipelineNode(pipeline: GraphNode): GraphNode {
        // Partition this pipeline's CG children into:
        //   drawables  – will become leaves of the BGG sub-tree
        //   otherState – viewport, scissor, etc.; must precede bind-group
        //                and draw commands in the encoded stream
        const drawables = pipeline.children.filter((c) => c.type === drawableType);
        const otherState = pipeline.children.filter((c) => c.type !== drawableType).map(buildNode);

        const bgRoots = bgSubtrees.get(pipeline.id);

        let bindGroupSubtreeRoots: GraphNode[];

        if (bgRoots && bgRoots.length > 0) {
            // Clone the entire BGG sub-tree for this pipeline occurrence so
            // it is independent of every other occurrence.
            const clonedRoots = bgRoots.map(cloneSubtree);
            const leaves = collectLeaves(clonedRoots);

            // Attach each leaf's assigned Drawables.
            //
            // Drawable nodes are themselves leaves (no children), so sharing
            // original CG Drawable references across multiple BGG leaves is
            // safe — the consumer will simply encode the draw call once per
            // leaf that owns it.  Provide matchDrawablesToLeaf to restrict
            // assignment when different draws require different bind-group
            // configurations.
            for (const leaf of leaves) {
                const assigned = matchDrawablesToLeaf(leaf, drawables);
                if (assigned.length > 0) {
                    leaf.children = [...leaf.children, ...assigned];
                }
            }

            bindGroupSubtreeRoots = clonedRoots;
        } else {
            // No BGG entry for this pipeline — degenerate case, preserve
            // the CG's Drawable children directly.
            bindGroupSubtreeRoots = drawables;
        }

        return new GraphNode(
            pipeline.id,
            pipeline.type,
            pipeline.data,
            // Non-Drawable state commands first, then the BGG sub-tree
            // (with Drawables appended at its leaves).
            [...otherState, ...bindGroupSubtreeRoots]
        );
    }

    return commandRoots.map(buildNode);
}
