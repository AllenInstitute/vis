import { describe, expect, it } from 'vitest';
import {
    AnnoStream,
    type AnnotationInfo,
    computeStride,
    extractPoint,
    getAnnotationBuffer,
    isPointAnnotation,
    parseInfoFromJson,
} from './annotations';

describe('quick check', () => {
    it('can parse a real (although simple) file, at least a little bit', async () => {
        const base =
            'https://aind-open-data.s3.amazonaws.com/SmartSPIM_787715_2025-04-08_18-33-36_stitched_2025-04-09_22-42-59/image_cell_segmentation/Ex_445_Em_469/visualization/detected_precomputed/';
        const expectedMetadata: AnnotationInfo<'point'> = {
            annotation_type: 'point', // TODO: the real json files here use lowercase, wtf
            type: 'neuroglancer_annotations_v1',
            dimensions: [
                { name: 'z', scale: 2e-6, unit: 'm' },
                { name: 'y', scale: 1.8e-6, unit: 'm' },
                { name: 'x', scale: 1.8e-6, unit: 'm' },
            ],
            lower_bound: [4.0, 94.0, 558.0],
            upper_bound: [3542.0, 8784.0, 7166.0],
            properties: [],
            relationships: [],
            by_id: { key: 'by_id' }, //what?
            spatial: [
                {
                    key: 'spatial0',
                    grid_shape: [1, 1, 1],
                    chunk_size: [3538.0, 8690.0, 6608.0],
                    limit: 150378,
                },
            ],
        };
        const infoFileJSON = await (await fetch(`${base}info`)).json();
        // biome-ignore lint/style/noNonNullAssertion: this is a test
        const sanitized = parseInfoFromJson(infoFileJSON)!;
        const stride = computeStride(expectedMetadata);
        expect(stride).toBe(12);
        expect(sanitized).toEqual(expectedMetadata);
        const raw = await getAnnotationBuffer(base, expectedMetadata, { level: 0, cell: [0, 0, 0] });
        expect(raw.numAnnotations).toBe(150378n);
        // each annotation (its shape and its properties) are written sequentially in the buffer,followed by all the ids for the annotations, like this:
        // [{num_annotations:uint64},{annotation_0_and_properties_and_optional_padding},...,{annotation_n_and_properties_and_optional_padding},{id_of_anno_0:uint64},...,{id_of_anno_n:uint64}}]
        // thus: 8 + (length*stride) + (size_in_bytes(uint64)*length)
        expect(raw.view.buffer.byteLength).toBe(150378 * stride + 8 + 150378 * 8);
        if (isPointAnnotation(sanitized)) {
            const annoStream = await AnnoStream(sanitized, extractPoint, raw.view, raw.numAnnotations);
            let count = 0;
            // the ids in here just count up... I think the spec says they should be added at random when doing spatial indexing, so this is sus....
            let lastId: bigint | undefined;
            for (const point of annoStream) {
                count += 1;
                if (lastId === undefined) {
                    lastId = point.id;
                } else {
                    expect(point.id).toBe(lastId + 1n);
                    lastId = point.id;
                }
                expect(point.properties).toEqual({});
            }
            expect(count).toBe(150378);
        } else {
            expect(sanitized?.annotation_type).toBe('point');
        }
    });
});
