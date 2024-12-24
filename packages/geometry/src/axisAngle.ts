import { Vec3, vec3 } from "./vec3";


export type AxisAngle = {
    readonly axis: vec3;
    readonly radians: number;
}

const identity: AxisAngle = {
    radians: 0,
    axis: [1, 0, 0]
}
/**
 * Note the ordering of arguments here - we follow the math convention of having the outer rotation left of the inner rotation "b (x) a"
 * when we say b (x) a, we mean that b happens "after" a, this is important because b (x) a =/= a (x) b
 * this is the opposite order of how programmers often write "reducer"-style functions eg. "fn(old_thing:X, next_event:A)=>X"
 * @param b the second rotation, in axis-angle form
 * @param a the first rotation, in axis-angle form
 * @returns a single rotation which is equivalent to the sequence of rotations "a then b"
 */
export function composeRotation(b: AxisAngle, a: AxisAngle): AxisAngle {
    const a2 = a.radians / 2
    const b2 = b.radians / 2
    const sinA = Math.sin(a2)
    const cosA = Math.cos(a2)
    const sinB = Math.sin(b2)
    const cosB = Math.cos(b2)
    const A = a.axis
    const B = b.axis
    // a2 and b2 are called half angles...
    const gamma = 2 * Math.acos(cosB * cosA - (Vec3.dot(B, A) * sinB * sinA))
    const D = Vec3.add(
        Vec3.add(Vec3.scale(B, sinB * cosA),
            Vec3.scale(A, sinA * cosB)),
        Vec3.scale(Vec3.cross(B, A), sinB * sinA));
    // TODO: normalization wont save us when the vector is near zero, or when the angle is k2pi.... sanitize!
    const dir = Vec3.normalize(D)
    if (!Vec3.finite(dir)) {
        return Vec3.finite(a.axis) ? a : identity
    }
    return { radians: gamma, axis: Vec3.normalize(D) }
}


/**
 * rotate a vector about a given axis (through the origin) by the given angle
 * @param rotation the parameters of the rotation, in axis-angle form, also known as Euler-vector (NOT to be confused with Euler-angles!)
 * @param v a 3D euclidean vector
 * @returns the vector v after being rotated
 */
export function rotateVector(rotation: AxisAngle, v: vec3): vec3 {
    // via rodrigues formula from the ancient past
    // var names from https://en.wikipedia.org/wiki/Rodrigues%27_rotation_formula
    const s = Math.sin(rotation.radians)
    const c = Math.cos(rotation.radians)
    const k = Vec3.normalize(rotation.axis)

    return Vec3.add(Vec3.add(Vec3.scale(v, c), Vec3.scale(Vec3.cross(k, v), s)),
        Vec3.scale(k, Vec3.dot(k, v) * (1 - c)))
}
