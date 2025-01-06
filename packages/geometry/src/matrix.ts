import { VectorLibFactory } from './vector'
import { Vec3, type vec3 } from './vec3'
import { type vec4 } from './vec4';


export type mat4 = readonly [vec4, vec4, vec4, vec4]

// these vec types are for internal use only

type _Vec<N extends number, E> = N extends 2 ? [E, E] :
    (N extends 3 ? [E, E, E] : (
        N extends 4 ? [E, E, E, E] : never
    ))
type Vec<N extends number, E> = N extends 2 ? readonly [E, E] :
    (N extends 3 ? readonly [E, E, E] : (
        N extends 4 ? readonly [E, E, E, E] : never
    ))

// a template for generating utils for square matricies
// note that you'll see a few 'as any' in the implementation here -
// I've been having trouble getting TS to use a literal number as a template that relates to the length of tuples
// all such cases are very short, and easy to verify as not-actually-risky

function MatrixLib<Dim extends 2 | 3 | 4>(N: Dim) {
    type mColumn = _Vec<Dim, number>
    type mMatrix = _Vec<Dim, mColumn>
    // the mutable types are helpful for all the internal junk we've got to do in here
    type Column = Vec<Dim, number>
    type Matrix = Vec<Dim, Column>

    const lib = VectorLibFactory<Column>();

    const fill = <T>(t: T): _Vec<Dim, T> => {
        const arr = new Array<T>(N);
        return arr.fill(t) as any
        // yup, typescript is lost here - thats ok, this function is very short and you can see its
        // making an array of a specific length, just as we expect
    }
    const map = <T>(vec: Vec<Dim, T>, fn: (t: T, i: number) => T): Vec<Dim, T> => {
        return vec.map(fn) as any; // sorry TS - you tried. we can see this is fine though
    }
    const zeros: () => mColumn = () => fill(0);
    const blank: () => mMatrix = () => {
        const z = zeros();
        const arr = new Array<mColumn>(N);
        for (let c = 0; c < N; c++) {
            arr[c] = [...z]
        }
        return arr as any;
    }
    const _identity = (): mMatrix => {
        const mat: mMatrix = blank();
        for (let i = 0; i < N; i++) {
            mat[i][i] = 1;
        }
        return mat;
    }
    const identity = (): Matrix => {
        return _identity();
    }
    const translate = (v: Column): Matrix => {
        const mat: mMatrix = _identity();
        mat[N - 1] = v as mColumn;
        return mat;
    }
    const transpose = (m: Matrix): Matrix => {
        const mat = blank();
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                mat[j][i] = m[i][j]
            }
        }
        return mat;
    }
    const mul = (a: Matrix, b: Matrix): Matrix => {
        const B = transpose(b);
        return map(a, (col: Column) => map(col, (_, r) => lib.dot(col, B[r])))
    }
    const transform = (a: Matrix, v: Column): Column => {
        const T = transpose(a)
        return map(v, (_, i) => lib.dot(v, T[i]))
    }

    const toColumnMajorArray = (m: mat4): number[] => m.flatMap(x => x)
    return {
        identity, mul, transpose, translate, transform, toColumnMajorArray
    }

}
type Mat4Lib = ReturnType<typeof MatrixLib<4>>;

/**
 * @param axis 
 * @param radians 
 * @returns a 4x4 matrix, expressing a rotation about the @param axis through the origin
 */
function rotateAboutAxis(axis: vec3, radians: number): mat4 {
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const icos = 1 - cos;
    const [x, y, z] = axis;
    const xx = x * x;
    const xy = x * y;
    const xz = x * z;
    const yz = y * z;
    const yy = y * y;
    const zz = z * z;
    // this function is not lovely, and thats because rotation in 3D is weird.
    // this is as nice as I can make it...
    const X: vec4 = [xx * icos + cos,
    xy * icos + (z * sin),
    xz * icos - (y * sin),
        0];
    const Y: vec4 = [
        xy * icos - (z * sin),
        yy * icos + cos,
        yz * icos + (x * sin),
        0
    ]
    const Z: vec4 = [
        xz * icos + (y * sin),
        yz * icos - (x * sin),
        zz * icos + cos,
        0
    ]
    const W: vec4 = [0, 0, 0, 1];
    return [X, Y, Z, W];
}
function rotateAboutPoint(lib: Mat4Lib, axis: vec3, radians: number, point: vec3): mat4 {
    const mul = lib.mul;
    const back = lib.translate([...point, 1])
    const rot = rotateAboutAxis(axis, radians);
    const move = lib.translate([...Vec3.scale(point, -1), 1])

    return mul(mul(move, rot), back);

}
const moverotmove = (lib: Mat4Lib) => (axis: vec3, radians: number, point: vec3) => rotateAboutPoint(lib, axis, radians, point)
const lib = MatrixLib(4)

export const Mat4 = { ...lib, rotateAboutAxis, rotateAboutPoint: moverotmove(lib) }
