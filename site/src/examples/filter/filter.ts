import { given, type ArrayBufferTables, type BufferTables } from '@alleninstitute/vis-core';

export async function init() {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
        return;
    }
    const canTimestamp = adapter.features.has('timestamp-query');
    const WG_SIZE = 64;

    const device = await adapter?.requestDevice({
        requiredLimits: {
            maxComputeInvocationsPerWorkgroup: WG_SIZE,
            maxComputeWorkgroupSizeX: WG_SIZE,
        },
        requiredFeatures: [
            ...(canTimestamp ? (['float32-blendable', 'timestamp-query'] as const) : (['float32-blendable'] as const)),
        ],
    });
    if (!device) {
        return;
    }

    return device;
}

function generateFake(
    dev: GPUDevice,
    each: (p: number, i: number) => number,
    count: number,
    type: 'f32' | 'u32' | 'i32'
) {
    const data =
        type === 'f32' ? new Float32Array(count) : type === 'i32' ? new Uint32Array(count) : new Uint32Array(count);
    for (let i = 0; i < count; i++) {
        data[i] = each(Math.random(), i);
    }
    const fake = dev.createBuffer({
        size: count * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    dev.queue.writeBuffer(fake, 0, data);
    return fake;
}

const tableLayout = {
    cells: { subclass: 'u32', gene_x: 'f32', position: 'vec2f' },
    edges: { start: 'u32', end: 'u32' },
} as const;
const aggLayout = {
    cells: { subclass: 'u32' },
    edges: { start: 'u32', end: 'u32', str: 'f32' },
} as const;

function generateFakeDataset(device: GPUDevice, edges: number, cells: number) {
    const positions = generateFake(device, (r) => r, cells * 2, 'f32');
    const subclass = generateFake(device, (_r, i) => i % 8, cells, 'u32');
    const gene_x = generateFake(device, (r) => (r * 100) % 8, cells, 'f32');

    const start = generateFake(device, (r) => Math.floor(r * cells), edges, 'u32');
    const end = generateFake(device, (r) => Math.floor(r * cells), edges, 'u32');
    const str = generateFake(device, (r) => 1.0 + r * 22.0, edges, 'f32');
    return { cells: { position: positions, subclass, gene_x }, edges: { start, end, str } } as const;
}
function setupAggregationDemo(device: GPUDevice, querySet: GPUQuerySet) {
    const { all, any, column, table, select, groupBy } = given(aggLayout).from('edges');
    // a realistic example - aggregate connection str over edges, grouped by subclass...
    // const agg = groupBy(column('subclass')).sum(column('gene_x'), '$count', '$unused', '$unused').build(device)
    const agg = groupBy(table('cells').at('start').dot('subclass'), table('cells').at('end').dot('subclass'))
        .sum(column('str'), '$count', '$unused', '$unused')
        .build(device);
    const w = 32;
    const h = 32; // hard to use a texture smaller than this...
    const results = device.createTexture({
        format: 'rg32float',
        size: { width: w, height: h, depthOrArrayLayers: 1 },
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const indirectBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT });
    device.queue.writeBuffer(indirectBuffer, 0, new Uint32Array([0, 1, 0, 0])); // uh 1 instance? hmmm
    const dims = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
    const resolve = device.createBuffer({ size: w * h * 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    device.queue.writeBuffer(dims, 0, new Uint32Array([w, h]));
    const doAggregate = (
        enc: GPUCommandEncoder,
        count: number | GPUBuffer,
        tables: ReturnType<typeof generateFakeDataset>,
        edges?: GPUBuffer
    ) => {
        if (typeof count !== 'number') {
            enc.copyBufferToBuffer(count, 0, indirectBuffer, 0, 4); // copy the count to the vertex count of the indirect call...
        }

        agg?.run(
            enc,
            [{ count: typeof count !== 'number' ? indirectBuffer : count, tables, elements: edges }],
            dims,
            results.createView(),
            [0,0,0,0],
            { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 }
        );
        enc.copyTextureToBuffer(
            { texture: results },
            { buffer: resolve, bytesPerRow: w * 8, rowsPerImage: h },
            { width: w, height: h }
        );
    };
    return { doAggregate, resolve, results, dims };
}
export function setupDemo(device: GPUDevice, edges: number, cells: number) {
    const { all, any, column, table, select, clause } = given(tableLayout).from('edges');
    const filter = select('$index')
        .select(table('cells').at('start').dot('gene_x'))
        .select(table('cells').at('start').dot('subclass'))
        .select(table('cells').at('end').dot('subclass'))
        .where(
            all(clause(table('cells').at('end').dot('subclass'), '==', 'toClass'))
                .and(clause(table('cells').at('start').dot('subclass'), '==', 'fromClass'))
                .and(clause(table('cells').at('start').dot('position'), 'all(>=)', 'minCorner'))
                .and(clause(table('cells').at('start').dot('position'), 'all(<)', 'maxCorner'))
        )
        .build(device, 'example');
    const aggregateQuerySet = device.createQuerySet({
        type: 'timestamp',
        count: 2,
    });
    const aggQueryResolveBuffer = device.createBuffer({
        label: 'aggregate query resolve',
        size: aggregateQuerySet.count * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const aggQueryResultBuffer = device.createBuffer({
        label: 'aggregate query result',
        size: aggQueryResolveBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const aggregate = setupAggregationDemo(device, aggregateQuerySet);
    const expectedResults = new DataView(new ArrayBuffer(4 * 4 * 2)); // index,gene,sub,sub, 4 bytes each, 2 expected matches
    expectedResults.setUint32(0, 1, true); // the first edge
    expectedResults.setFloat32(4, 0.2, true);
    expectedResults.setUint32(8, 1, true);
    expectedResults.setUint32(12, 2, true);

    expectedResults.setUint32(16, 4, true); // the second match, the 5th edge in the list
    expectedResults.setFloat32(20, 0.2, true);
    expectedResults.setUint32(24, 1, true);
    expectedResults.setUint32(28, 2, true);
    // for fun, validate at runtime?
    filter.validate(
        device,
        filter.serializeParameters,
        {
            cells: {
                position: new Float32Array([
                    0.5,
                    0.5,
                    0.25,
                    0.25,
                    0.5,
                    0.5,
                    0.5,
                    0.5,
                    2,
                    2, // excluded by the min/max Corner check
                ]),
                subclass: new Uint32Array([0, 1, 2, 2, 1]),
                gene_x: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
            },
            edges: {
                start: new Uint32Array([1, 1, 4, 0, 1]),
                end: new Uint32Array([0, 2, 3, 4, 3]),
            },
        },
        { fromClass: 1, toClass: 2, minCorner: [0, 0], maxCorner: [1, 1] },
        expectedResults,
        5
    );

    const outputSizeBytes = 16;

    type RowType = readonly [number, number, number, number];
    const extractRow = (row: number, dv: DataView) => {
        return [
            dv.getUint32(row * outputSizeBytes, true),
            dv.getFloat32(row * outputSizeBytes + 4, true),
            dv.getUint32(row * outputSizeBytes + 8, true),
            dv.getUint32(row * outputSizeBytes + 12, true),
        ] as const;
    };

    const params = filter.serializeParameters({
        toClass: 4,
        fromClass: 3,
        minCorner: [0, 0],
        maxCorner: [0.9, 0.9],
    });
    const paramBuffer = device.createBuffer({
        size: params.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const dataset = generateFakeDataset(device, edges, cells);

    const results = // generateFake(device, (_r) => 0, edges * (outputSizeBytes / 4), 'u32');
        device.createBuffer({
            label: 'filter results',
            size: edges * outputSizeBytes,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
    const resultCounter = generateFake(device, (r) => r, 1, 'u32');

    const resultReader = device.createBuffer({
        label: 'mappable result reader',
        size: edges * outputSizeBytes,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const usedReader = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // filter-timing query buffers //
    const querySet = device.createQuerySet({
        type: 'timestamp',
        count: 2,
    });

    const resolveBuffer = device.createBuffer({
        size: querySet.count * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const queryResultBuffer = device.createBuffer({
        size: resolveBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const doFilter = (
        params: Parameters<(typeof filter)['serializeParameters']>[0],
        onFilterComplete: (rows: Array<RowType>, statistics: number[][], gpuTime: number, aggTime: number) => void
    ) => {
        const serialized = filter.serializeParameters(params);
        device.queue.writeBuffer(paramBuffer, 0, serialized, 0, serialized.byteLength);
        const enc = device.createCommandEncoder();
        filter.run({
            enc,
            timestampWrites: {
                querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1,
            },
            parameters: paramBuffer,
            sets: [
                {
                    resultCounter,
                    results,
                    rowCount: edges,
                    tables: dataset,
                },
            ],
        });
        enc.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
        enc.copyBufferToBuffer(resolveBuffer, queryResultBuffer);
        enc.copyBufferToBuffer(results, 0, resultReader, 0, edges * outputSizeBytes);
        enc.copyBufferToBuffer(resultCounter, 0, usedReader, 0, resultCounter.size);
        aggregate.doAggregate(enc, edges, dataset);
        enc.resolveQuerySet(aggregateQuerySet, 0, aggregateQuerySet.count, aggQueryResolveBuffer, 0);
        enc.copyBufferToBuffer(aggQueryResolveBuffer, aggQueryResultBuffer);
        device.queue.submit([enc.finish()]);

        const copyOut = (buffer: GPUBuffer, byteRange?: number) => {
            const data = byteRange === undefined ? buffer.getMappedRange() : buffer.getMappedRange(0, byteRange);
            const copy = new Uint32Array(data.byteLength / 4);
            copy.set(new Uint32Array(data));
            buffer.unmap();
            return copy;
        };
        Promise.all([
            usedReader.mapAsync(GPUMapMode.READ),
            aggregate.resolve.mapAsync(GPUMapMode.READ),
            queryResultBuffer.mapAsync(GPUMapMode.READ),
            resultReader.mapAsync(GPUMapMode.READ),
            aggQueryResultBuffer.mapAsync(GPUMapMode.READ),
        ]).then(() => {
            // wait for all the data to show up, then do all the timing and result reporting...
            const filterGpuTime = new BigUint64Array(copyOut(queryResultBuffer).buffer);
            const aggGpuTime = new BigUint64Array(copyOut(aggQueryResultBuffer).buffer);
            const used = copyOut(usedReader);
            const usedElems = used[0]!;
            const filteredResults = copyOut(resultReader, Math.max(16, usedElems * outputSizeBytes)).buffer;
            const aggregationTable = new Float32Array(copyOut(aggregate.resolve).buffer);
            // interpret the results... aka make some javascript data:
            const dv = new DataView(filteredResults);
            const rows: Array<RowType> = [];
            for (let row = 0; row < usedElems; row++) {
                rows.push(extractRow(row, dv));
            }
            const statistics: number[][] = [];
            for (let row = 0; row < 8; row++) {
                statistics[row] = [];
                for (let col = 0; col < 8; col++) {
                    const index = row * 32 * 2 + col * 2;
                    const sum = aggregationTable[index];
                    const count = aggregationTable[index + 1];
                    statistics[row].push(sum / count);
                }
            }
            onFilterComplete(
                rows,
                statistics,
                Number(filterGpuTime[1]! - filterGpuTime[0]!) / 1_000_000,
                Number(aggGpuTime[1]! - aggGpuTime[0]!) / 1_000_000
            );
        });
    };
    return doFilter;
}
