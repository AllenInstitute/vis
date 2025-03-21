import type { box } from '../BoundingBox';

export type SpatialTreeInterface<Tree, Content, V extends ReadonlyArray<number>> = {
    bounds: (t: Tree) => box<V>;
    content: (t: Tree) => Content;
    children: (t: Tree) => ReadonlyArray<Tree>;
};

export function visitBFS<Tree>(
    tree: Tree,
    children: (t: Tree) => ReadonlyArray<Tree>,
    visitor: (tree: Tree) => void,
    traversalPredicate?: (t: Tree) => boolean,
): void {
    const frontier: Tree[] = [tree];
    while (frontier.length > 0) {
        const cur = frontier.shift();
        if (cur === undefined) {
            // TODO: Consider logging a warning or error here, as this should never happen,
            // but this package doesn't depend on the package where our logger lives
            continue;
        }
        visitor(cur);
        for (const c of children(cur)) {
            if (traversalPredicate?.(c) ?? true) {
                // predicate?.(c) is true false or undefined. if its undefined, we coerce it to true with ??
                // because we want to always traverse children if the predicate isn't given
                frontier.push(c);
            }
        }
    }
}
