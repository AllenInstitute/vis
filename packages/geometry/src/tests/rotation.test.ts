import { describe, expect, test } from 'vitest';
import { Mat4 } from '../matrix';
import { Vec3, type vec3 } from '../vec3';
import { Vec4, type vec4 } from '../vec4';
import { type AxisAngle, composeRotation, rotateVector } from '../axisAngle';

function nearly(actual: vec3, expected: vec3) {
    const _dst = Vec3.length(Vec3.sub(actual, expected));

    for (let i = 0; i < 3; i++) {
        expect(actual[i]).toBeCloseTo(expected[i]);
    }
}

describe('rotation in various ways', () => {
    describe('axis angle...', () => {
        test('basics', () => {
            const rot: AxisAngle = {
                radians: Math.PI / 2, // 90 degrees
                axis: [0, 0, 1],
            };
            const v: vec3 = [1, 0, 0];
            nearly(rotateVector(rot, v), [0, 1, 0]);
            // 90+90+90
            const twoSeventy = composeRotation(rot, composeRotation(rot, rot));
            nearly(rotateVector(twoSeventy, v), [0, -1, 0]);
        });
        test('non-axis aligned...', () => {
            const thirty: AxisAngle = {
                axis: Vec3.normalize([1, 1, 0]),
                radians: Math.PI / 6,
            };
            const v: vec3 = [-1, 1, 0];
            const ninty = composeRotation(thirty, composeRotation(thirty, thirty));
            nearly(ninty.axis, Vec3.normalize([1, 1, 0]));
            expect(ninty.radians).toBeCloseTo(Math.PI / 2);
            nearly(rotateVector(ninty, v), [0, 0, Vec3.length(v)]);
        });
        test('degenerate radians', () => {
            const nada: AxisAngle = {
                axis: Vec3.normalize([1, 1, 0]),
                radians: 0,
            };
            const v: vec3 = [-1, 1, 0];
            const r = composeRotation(nada, nada);
            nearly(rotateVector(r, v), v);
        });
        test('degenerate axis', () => {
            const nada: AxisAngle = {
                axis: Vec3.normalize([0, 0, 0]),
                radians: Math.PI / 4,
            };
            const fine: AxisAngle = {
                axis: Vec3.normalize([1, 0, 0]),
                radians: Math.PI / 4,
            };
            const v: vec3 = [-1, 1, 0];
            const r = composeRotation(nada, nada);
            nearly(rotateVector(r, v), v);
            const r2 = composeRotation(nada, fine);
            nearly(rotateVector(r2, v), rotateVector(fine, v));
        });
        test('error does not accumulate at this scale', () => {
            const steps = 10000; // divide a rotation into ten thousand little steps, then compose each to re-build a 180-degree rotation
            const little: AxisAngle = {
                axis: Vec3.normalize([1, 1, 1]),
                radians: Math.PI / steps,
            };
            const expectedRotation: AxisAngle = {
                axis: Vec3.normalize([1, 1, 1]),
                radians: Math.PI,
            };
            const v: vec3 = [-22, 33, 2];
            let total = little;
            for (let i = 1; i < steps; i++) {
                total = composeRotation(little, total);
            }
            nearly(rotateVector(total, v), rotateVector(expectedRotation, v));
            nearly(rotateVector(composeRotation(total, total), v), v);
        });
    });
    describe('matrix works the same', () => {
        const randomAxis = (): vec3 => {
            const theta = Math.PI * 100 * Math.random();
            const sigma = Math.PI * 100 * Math.random();
            const x = Math.cos(theta) * Math.sin(sigma);
            const y = Math.sin(theta) * Math.sin(sigma);
            const z = Math.cos(sigma);
            // always has length 1... I think?
            return Vec3.normalize([x, y, z]);
        };
        test('rotateAboutAxis and axis angle agree (right hand rule... right?)', () => {
            const axis: vec3 = Vec3.normalize([0.5904, -0.6193, -0.5175]);
            expect(Vec3.length(axis)).toBeCloseTo(1, 8);
            const v: vec3 = [0.4998, 0.053, 0.8645];
            expect(Vec3.length(v)).toBeCloseTo(1, 3);
            const angle = -Math.PI / 4;
            const mat = Mat4.rotateAboutAxis(axis, angle);
            const aa: AxisAngle = { axis, radians: angle };
            const a = rotateVector(aa, v);
            const b = Vec4.xyz(Mat4.transform(mat, [...v, 0]));
            nearly(b, a);
        });
        test('repeated rotations about random axes match the equivalent matrix rotateVector...', () => {
            let v: vec3 = [1, 0, 0];
            for (let i = 0; i < 300; i++) {
                const axis = randomAxis();
                expect(Vec3.length(axis)).toBeCloseTo(1);
                const angle = Math.PI / 360 + Math.random() * Math.PI;
                const dir = Math.random() > 0.5 ? -1 : 1;
                const mat = Mat4.rotateAboutAxis(axis, angle * dir);
                const aa: AxisAngle = { axis, radians: dir * angle };
                // rotateVector v by each
                const v4: vec4 = [...v, 0];
                const mResult = Mat4.transform(mat, v4);
                const aaResult = rotateVector(aa, v);
                nearly(Vec4.xyz(mResult), aaResult);
                v = aaResult;
            }
        });
    });
    describe('rotation about a point which is not the origin', () => {
        test('an easy to understand example', () => {
            const v: vec4 = [1, 0, 0, 1];
            const yAxis: vec3 = [0, 1, 0];
            const origin: vec3 = [2, 0, 0];

            // o----v---|---x
            // 0----1---2---3---4---

            // o = the true origin
            // v = the point v
            // | = the y-axis through the point [2,0,0]
            // x = imagine rotating v around the | by 180, you get x
            const rot = Mat4.rotateAboutPoint(yAxis, Math.PI, origin);
            nearly(Vec4.xyz(Mat4.transform(rot, v)), [3, 0, 0]);
        });
    });
});
