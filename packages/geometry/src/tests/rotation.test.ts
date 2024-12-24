import { describe, expect, test } from "vitest";
import { Mat4, rotateAboutAxis } from "../matrix";
import { Vec3, vec3 } from "../vec3"
import { Vec4, type vec4 } from "../vec4";
import { AxisAngle, composeRotation, rotateVector } from "../axisAngle";

// TODO: delete the quaternion stuff
// A versor is a (Unit) Quaternion, for representing a rotation in 3D
export type Versor = Readonly<{
    qi: number;
    qj: number;
    qk: number;
    qr: number; // the scalar term
}>

export function versorFromAxisAngle(rotation: AxisAngle): Versor {
    const sin = Math.sin(rotation.radians / 2)
    const cos = Math.cos(rotation.radians / 2)
    const e = Vec3.normalize(rotation.axis)
    const [x, y, z] = e
    return {
        qi: x * sin,
        qj: y * sin,
        qk: z * sin,
        qr: cos
    }
}
export function axisAngleFromVersor(rotation: Versor): AxisAngle {
    const { qi, qj, qk, qr } = rotation
    const q: vec3 = [qi, qj, qk]
    const D = Math.sqrt(Vec3.dot(q, q))
    const theta = Math.atan2(D, qr)
    const axis = Vec3.scale(q, 1 / D)
    return { axis, radians: theta }
}
// rotate by q2 "after" q1
// if you read q2 x q1, then you'd call compose(q2,q1)
function compose(q2: Versor, q1: Versor): Versor {
    const { qr: r2, qi: i2, qj: j2, qk: k2 } = q2
    const { qr: r1, qi: i1, qj: j1, qk: k1 } = q1
    // source: 
    const r = (r2 * r1 - i2 * i1 - j2 * j1 - k2 * k1)
    const i = (r2 * i1 + i2 * r1 + j2 * k1 - k2 * j1)
    const j = (r2 * j1 - i2 * k1 + j2 * r1 + k2 * i1)
    const k = (r2 * k1 + i2 * j1 - j2 * i1 + k2 * r1)

    return {
        qi: i,
        qj: j,
        qk: k,
        qr: r
    }
}


function nearly(actual: vec3, expected: vec3) {
    const dst = Vec3.length(Vec3.sub(actual, expected))
    if (dst > 0.0001) {
        console.log('expected', expected, 'recieved: ', actual)
    }
    for (let i = 0; i < 3; i++) {
        expect(actual[i]).toBeCloseTo(expected[i])
    }
}

describe('rotation in various ways', () => {
    describe('axis angle...', () => {
        test('basics', () => {
            const rot: AxisAngle = {
                radians: Math.PI / 2, // 90 degrees
                axis: [0, 0, 1]
            }
            const v: vec3 = [1, 0, 0]
            nearly(rotateVector(rot, v), [0, 1, 0])
            // 90+90+90
            const twoSeventy = composeRotation(rot, composeRotation(rot, rot))
            nearly(rotateVector(twoSeventy, v), [0, -1, 0])
        })
        test('non-axis aligned...', () => {
            const thirty: AxisAngle = {
                axis: Vec3.normalize([1, 1, 0]),
                radians: Math.PI / 6
            }
            const v: vec3 = [-1, 1, 0]
            const ninty = composeRotation(thirty, composeRotation(thirty, thirty))
            nearly(ninty.axis, Vec3.normalize([1, 1, 0]))
            expect(ninty.radians).toBeCloseTo(Math.PI / 2)
            nearly(rotateVector(ninty, v), [0, 0, Vec3.length(v)])
        })
        test('degenerate radians', () => {
            const nada: AxisAngle = {
                axis: Vec3.normalize([1, 1, 0]),
                radians: 0,
            }
            const v: vec3 = [-1, 1, 0]
            const r = composeRotation(nada, nada)
            nearly(rotateVector(r, v), v)

        })
        test('degenerate axis', () => {
            const nada: AxisAngle = {
                axis: Vec3.normalize([0, 0, 0]),
                radians: Math.PI / 4,
            }
            const fine: AxisAngle = {
                axis: Vec3.normalize([1, 0, 0]),
                radians: Math.PI / 4,
            }
            const v: vec3 = [-1, 1, 0]
            const r = composeRotation(nada, nada)
            nearly(rotateVector(r, v), v)
            const r2 = composeRotation(nada, fine)
            nearly(rotateVector(r2, v), rotateVector(fine, v))

        })
        test('error does not accumulate at this scale', () => {
            const steps = 10000; // divide a rotation into ten thousand little steps, then compose each to re-build a 180-degree rotation
            const little: AxisAngle = {
                axis: Vec3.normalize([1, 1, 1]),
                radians: Math.PI / steps
            }
            const expectedRotation: AxisAngle = {
                axis: Vec3.normalize([1, 1, 1]),
                radians: Math.PI
            }
            const v: vec3 = [-22, 33, 2]
            let total = little;
            for (let i = 1; i < steps; i++) {
                total = composeRotation(little, total)
            }
            nearly(rotateVector(total, v), rotateVector(expectedRotation, v))
            nearly(rotateVector(composeRotation(total, total), v), v)
        })
        describe('matrix works the same', () => {
            const randomAxis = (): vec3 => {
                const theta = Math.PI * 100 * Math.random()
                const sigma = Math.PI * 100 * Math.random()
                const x = Math.cos(theta) * Math.sin(sigma)
                const y = Math.sin(theta) * Math.sin(sigma)
                const z = Math.cos(sigma);
                // always has length 1... I think?
                return [x, y, z]
            }
            test('rotateAboutAxis and axis angle agree (right hand rule... right?)', () => {
                const axis: vec3 = Vec3.normalize([0.5904, -0.6193, -0.5175])
                expect(Vec3.length(axis)).toBeCloseTo(1, 8)
                const v: vec3 = [0.4998, 0.0530, 0.8645]
                expect(Vec3.length(v)).toBeCloseTo(1, 3)
                const angle = -Math.PI / 4
                const mat = rotateAboutAxis(axis, angle)
                const aa: AxisAngle = { axis, radians: angle }
                const a = rotateVector(aa, v)
                const b = Vec4.xyz(Mat4.transform(mat, [...v, 0]))
                nearly(b, a)
            })
            test('repeated rotations about random axes match the equivalent matrix rotateVector...', () => {
                let v: vec3 = [1, 0, 0]
                for (let i = 0; i < 300; i++) {
                    const axis = randomAxis()
                    expect(Vec3.length(axis)).toBeCloseTo(1)
                    const angle = (Math.PI / 360) + (Math.random() * Math.PI)
                    const dir = Math.random() > 0.5 ? -1 : 1
                    const mat = rotateAboutAxis(axis, angle * dir)
                    const aa: AxisAngle = { axis, radians: dir * angle }
                    // rotateVector v by each 
                    // console.log('-------------------------------------')
                    // console.log(`rotate (${v[0].toFixed(4)}, ${v[1].toFixed(4)}, ${v[2].toFixed(4)}) about`)
                    // console.log(`<${axis[0].toFixed(4)}, ${axis[1].toFixed(4)}, ${axis[2].toFixed(4)}> by ${(angle * dir).toFixed(5)} `)
                    const v4: vec4 = [...v, 0]
                    const mResult = Mat4.transform(mat, v4)
                    const aaResult = rotateVector(aa, v)
                    nearly(Vec4.xyz(mResult), aaResult)
                    v = aaResult
                }
            })
        })
    })

})