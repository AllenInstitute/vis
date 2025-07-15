import { describe, it, expect } from 'vitest';
import { CartesianPlane } from '@alleninstitute/vis-geometry';
import { OmeZarrAxisSchema } from './types';

describe('OmeZarrAxisSchema', () => {
    it('should convert the axis name to lowercase when parsed to match our Cartesian Plane', () => {
        const result = OmeZarrAxisSchema.parse({
            name: 'X',
            type: 'space',
        });

        // Create a concrete CartesianPlane to compare with so we know the parsed data will interop correctly
        const plane = new CartesianPlane('xy');
        expect(result.name).toBe(plane.u);
    });
});
