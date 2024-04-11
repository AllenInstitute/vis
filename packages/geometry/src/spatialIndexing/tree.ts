import type { box } from '../BoundingBox'

export type SpatialTreeInterface<Tree, Content, V extends ReadonlyArray<number>> = {
    bounds: (t: Tree) => box<V>;
    content: (t: Tree) => Content;
    children: (t: Tree) => ReadonlyArray<Tree>;
};

export function visitBFS<Tree>(
    tree: Tree,
    children: (t: Tree) => ReadonlyArray<Tree>,
    visitor: (tree: Tree) => void,
    traversalPredicate?: (t: Tree) => boolean
): void {
    const frontier: Tree[] = [tree];
    while (frontier.length > 0) {
        const cur = frontier.shift()!;
        visitor(cur);
        children(cur).forEach((c) => {
            if (traversalPredicate?.(c) ?? true) {
                // predicate?.(c) is true false or undefined. if its undefined, we coerce it to true with ??
                // because we want to always traverse children if the predicate isn't given
                frontier.push(c);
            }
        });
    }
}
