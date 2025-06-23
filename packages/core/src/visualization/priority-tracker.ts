
// we have a server, and it has multiple clients
// the interface for the client is to periodically say:
//  server.prioritize(clientId,...things)

// we would also like to track the set of prioritized items per client
//  so that we can make incremental updates to our global priorities over all clients
// TODO we dont need anything in here delete me
class PriorityTracker<T> {
    private priorities: Map<string, T>;

    constructor() {
        this.priorities = new Map()
        this.priorities.val
    }
    setPriorities: (set: ReadonlySet<T>):{ added: Set<string>, removed: Set<string> } {

}
}

type Spec<C, T> = {
    has: (collection: C, t: T) => boolean // collection contains t
    values: (collection: C) => Iterable<T>
}
function diff<C, T>(A: C, B: C, spec: Spec<C, T>) {
    const AnotB = new Set<T>()
    const BnotA = new Set<T>()
    for (const a of spec.values(A)) {
        if (!spec.has(B, a)) {
            AnotB.add(a)
        }
    }
    for (const b of spec.values(B)) {
        if (!spec.has(A, b)) {
            BnotA.add(b)
        }
    }
    return { justA: AnotB, justB: BnotA }
}

export function diffSets<T>(A: Set<T>, B: Set<T>) {
    return diff(A, B, {
        has: (s, t: T) => s.has(t),
        values: (s) => s.values()
    })
}
export function diffMaps<K, T>(A: Map<K, T>, B: Map<K, T>, keyFn: (t: T) => K) {
    return diff(A, B, {
        has: (s, t: T) => s.has(keyFn(t)),
        values: (s) => s.values()
    })
}
export function diffRecords<K extends string | number | symbol, T>(A: Record<K, T>, B: Record<K, T>, keyFn: (t: T) => K) {
    return diff(A, B, {
        has: (s, t: T) => keyFn(t) in s,
        values: (s) => Object.values(s)
    })
}