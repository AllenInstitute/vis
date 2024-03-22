// this is a utility file for producing 'libraries' that provide basic math operations
// on short vectors. The vectors here are readonly tuples of numbers -
// I think vectors are more like numbers than objects, so immutable 'value semantics' makes
// much more sense to me.
// furthermore, I have all the 'methods' that would act on a class of vectors in a separate
// object, more like a module. I like the data to be plain old data - its immutability
// makes it easy to stash in redux, and Pojo's can be serialized (or copied to a web-worker)
// very easily.
// its also, IMHO, very slightly more flexible - these libraries just operate on readonly arrays -
// no need to extend any interfaces, no need to buy into my world view - its easy to just pass in
// a literal array on the fly (eg. add([1,1], someOtherVector))
// anyway - probably start at the end of this file -
// the type VectorLib<V> and the factory that produces libraries for a given vector type (1d, 2d... 66d etc)
// if you want to see on in action, check out vec2.ts

type binOp<T> = (a: T, b: T) => T;
type scalarOp<T> = (a: T, scalar: number) => T;
type reduceOp<T> = (a: T) => number;
type unaryOp<T> = (a: T) => T;
type predOp<T> = (a: T) => boolean;
type VectorConstraint = ReadonlyArray<number>;
function componentOpFn<T extends VectorConstraint>(op: binOp<number>): binOp<T> {
    return (a: T, b: T) => {
        const r: Array<number> = [...a];
        for (let i = 0; i < a.length; i += 1) {
            r[i] = op(a[i], b[i]);
        }
        // its fine - we're trying to present things as though they are readonly, immutable
        // static-length arrays of numbers, all in the service of semi-generic vector convenience...
        return r as unknown as T;
    };
}
function componentUnaryOpFn<T extends VectorConstraint>(op: unaryOp<number>): unaryOp<T> {
    return (a: T) => {
        const r: Array<number> = [...a];
        for (let i = 0; i < a.length; i += 1) {
            r[i] = op(a[i]);
        }
        // its fine - we're trying to present things as though they are readonly, immutable
        // static-length arrays of numbers, all in the service of semi-generic vector convenience...
        return r as unknown as T;
    };
}
function reduceComponentOpFn<T extends VectorConstraint>(op: binOp<number>): reduceOp<T> {
    return (a: T) => {
        let r: number = a[0];
        for (let i = 1; i < a.length; i += 1) {
            r = op(r, a[i]);
        }
        return r;
    };
}
function scalarOpFn<T extends VectorConstraint>(op: scalarOp<number>): scalarOp<T> {
    return (a: T, scalar: number) => {
        const r: Array<number> = [...a];
        for (let i = 0; i < a.length; i += 1) {
            r[i] = op(a[i], scalar);
        }
        // its fine - we're trying to present things as though they are readonly, immutable
        // static-length arrays of numbers, all in the service of semi-generic vector convenience...
        return r as unknown as T;
    };
}

function allCmp<T extends VectorConstraint>(op: predOp<number>): predOp<T> {
    return (a: T) => {
        let truth = true;
        for (let i = 0; i < a.length; i += 1) {
            truth = truth && op(a[i]);
        }
        return truth;
    };
}
function anyCmp<T extends VectorConstraint>(op: predOp<number>): predOp<T> {
    return (a: T) => {
        let truth = false;
        for (let i = 0; i < a.length; i += 1) {
            truth = truth || op(a[i]);
        }
        return truth;
    };
}

export type VectorLib<T> = Readonly<{
    add: binOp<T>;
    sub: binOp<T>;
    mul: binOp<T>;
    div: binOp<T>;
    min: binOp<T>;
    map: (v: T, op: (c: number, index: number) => number) => T;
    max: binOp<T>;
    minComponent: reduceOp<T>;
    maxComponent: reduceOp<T>;
    floor: unaryOp<T>;
    ceil: unaryOp<T>;
    scale: scalarOp<T>;
    mix: (a: T, b: T, p: number) => T;
    sum: reduceOp<T>;
    dot: (a: T, b: T) => number;
    length: reduceOp<T>;
    normalize: unaryOp<T>;
    finite: predOp<T>;
    any: (v: T, op: (c: number) => boolean) => boolean;
    all: (v: T, op: (c: number) => boolean) => boolean;
    exactlyEqual: (a: T, b: T) => boolean;
    swizzle: binOp<T>;
}>;
// see the rambling at the top of this file for more details
// TLDR: return a module with functions that perform basic math
// on vectors, where vector means an immutable array of numbers with a known length
// note that this function will generate a library suitable for any length of vector -
// just pass its type (eg. readonly [number,number,number]) as the generic V
export function VectorLibFactory<V extends VectorConstraint>(): VectorLib<V> {
    const add = componentOpFn<V>((a, b) => a + b);
    const sub = componentOpFn<V>((a, b) => a - b);
    const mul = componentOpFn<V>((a, b) => a * b);
    const div = componentOpFn<V>((a, b) => a / b);
    const min = componentOpFn<V>((a, b) => Math.min(a, b));
    const max = componentOpFn<V>((a, b) => Math.max(a, b));
    const floor = componentUnaryOpFn<V>((a) => Math.floor(a));
    const ceil = componentUnaryOpFn<V>((a) => Math.ceil(a));
    const scale = scalarOpFn<V>((a, b) => a * b);
    const mix = (a: V, b: V, p: number) => add(scale(a, 1.0 - p), scale(b, p));
    const sum = reduceComponentOpFn<V>((a, b) => a + b);
    const minComponent = reduceComponentOpFn<V>((a, b) => Math.min(a, b));
    const maxComponent = reduceComponentOpFn<V>((a, b) => Math.max(a, b));
    const dot = (a: V, b: V) => sum(mul(a, b));
    const length = (a: V) => Math.sqrt(sum(mul(a, a)));
    const normalize = (a: V) => scale(a, 1.0 / length(a));
    const finite = allCmp<V>((a) => Number.isFinite(a)); // no NaNs, no +- Infinities
    const any = (vec: V, op: predOp<number>) => anyCmp<V>(op)(vec);
    const all = (vec: V, op: predOp<number>) => allCmp<V>(op)(vec);
    const exactlyEqual = (a: V, b: V) => all(sub(a, b), (v) => v === 0);
    const map = (v: V, fn: (c: number, index: number) => number) => v.map(fn) as unknown as V;
    // return a re-indexed vector - for example
    // swizzle([33,22,11], [1,1,0])==> [22,22,33]
    // note that passing invalid indexes will result in values of undefined in affected components of the result
    const swizzle = (v: V, index: V) => index.map((i) => v[i]) as unknown as V;
    return {
        add,
        sub,
        mul,
        div,
        min,
        map,
        max,
        minComponent,
        maxComponent,
        floor,
        ceil,
        scale,
        mix,
        sum,
        dot,
        length,
        normalize,
        finite,
        any,
        all,
        exactlyEqual,
        swizzle,
    };
}
