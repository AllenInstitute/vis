/**
 * Minimal column-major 4x4 matrix helpers for the demo camera + per-shape transforms.
 *
 * Self-contained (rather than `@alleninstitute/vis-geometry`) so the math is unambiguous and the
 * results are directly uploadable to a WGSL `mat4x4f` uniform: a `Mat4` is a length-16
 * `Float32Array` in column-major order. `multiply(a, b)` is the conventional product `a · b`, and
 * `perspective` targets WebGPU clip space (depth range 0..1).
 */

export type Mat4 = Float32Array;
export type Vec3 = readonly [number, number, number];

export function identity(): Mat4 {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}

/** Standard column-major product `a · b`. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += (a[k * 4 + row] as number) * (b[col * 4 + k] as number);
            out[col * 4 + row] = sum;
        }
    }
    return out;
}

/** Compose transforms left-to-right: `multiplyAll(A, B, C)` = `A · B · C`. */
export function multiplyAll(...mats: Mat4[]): Mat4 {
    return mats.reduce((acc, m) => multiply(acc, m), identity());
}

export function translation(x: number, y: number, z: number): Mat4 {
    const m = identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
}

/** Rotation of `angle` radians about (normalized) `axis` — Rodrigues' formula, column-major. */
export function rotationAxis(axis: Vec3, angle: number): Mat4 {
    const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    const x = axis[0] / len;
    const y = axis[1] / len;
    const z = axis[2] / len;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const t = 1 - c;
    const m = identity();
    m[0] = t * x * x + c;
    m[1] = t * x * y + s * z;
    m[2] = t * x * z - s * y;
    m[4] = t * x * y - s * z;
    m[5] = t * y * y + c;
    m[6] = t * y * z + s * x;
    m[8] = t * x * z + s * y;
    m[9] = t * y * z - s * x;
    m[10] = t * z * z + c;
    return m;
}

/** Right-handed perspective for WebGPU clip space (z in 0..1). `fovY` in radians. */
export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = far * nf;
    m[11] = -1;
    m[14] = near * far * nf;
    return m;
}

function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function normalize(v: Vec3): Vec3 {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
}

/** Right-handed look-at view matrix. */
export function lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
    const z = normalize(sub(eye, center));
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    const m = identity();
    m[0] = x[0];
    m[1] = y[0];
    m[2] = z[0];
    m[4] = x[1];
    m[5] = y[1];
    m[6] = z[1];
    m[8] = x[2];
    m[9] = y[2];
    m[10] = z[2];
    m[12] = -dot(x, eye);
    m[13] = -dot(y, eye);
    m[14] = -dot(z, eye);
    return m;
}
