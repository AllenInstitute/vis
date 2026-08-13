import { given } from '@alleninstitute/vis-core';

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
        requiredFeatures: [...(canTimestamp ? ['timestamp-query' as const] : [])],
    });
    if (!device) {
        return;
    }

    return device;
}

function generateFake(dev: GPUDevice, each: (p: number) => number, count: number, type: 'f32' | 'u32' | 'i32') {
    const data =
        type === 'f32' ? new Float32Array(count) : type === 'i32' ? new Uint32Array(count) : new Uint32Array(count);
    for (let i = 0; i < count; i++) {
        data[i] = each(Math.random());
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
type gpuDataset = {
    cells: { [k in keyof (typeof tableLayout)['cells']]: GPUBuffer };
    edges: { [k in keyof (typeof tableLayout)['edges']]: GPUBuffer };
};
function generateFakeDataset(device: GPUDevice, edges: number, cells: number): gpuDataset {
    const positions = generateFake(device, (r) => r, cells * 2, 'f32');
    const subclass = generateFake(device, (r) => (r * 100) % 8, cells, 'u32');
    const gene_x = generateFake(device, (r) => (r * 100) % 8, cells, 'f32');

    const start = generateFake(device, (r) => Math.floor(r * cells), edges, 'u32');
    const end = generateFake(device, (r) => Math.floor(r * cells), edges, 'u32');
    const str = generateFake(device, (r) => 1.0 + r * 22.0, edges, 'f32');
    return { cells: { position: positions, subclass, gene_x }, edges: { start, end } };
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
        .build(device);
    // .select('$index')
    //   .select()
    // .select('cells[start].gene_x')
    // .select('cells[start].subclass')
    // .select('cells[end].subclass')
    // .where('cells[end].subclass == toClass')
    // .andOpen('cells[start].subclass == fromClass')
    // .and('cells[start].position all(>=) minCorner')
    // .and('cells[start].position all(<) maxCorner')
    // .close()
    // .build(device, 'testing');
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

    const results = generateFake(device, (_r) => 0, edges * (outputSizeBytes / 4), 'u32');
    const resultCounter = generateFake(device, (r) => r, 1, 'u32');

    const resultReader = device.createBuffer({
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
        onFilterComplete: (rows: Array<RowType>, gpuTime: number) => void
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
        enc.copyBufferToBuffer(resolveBuffer, 0, queryResultBuffer, 0, queryResultBuffer.size);
        enc.copyBufferToBuffer(results, 0, resultReader, 0, edges * outputSizeBytes);
        enc.copyBufferToBuffer(resultCounter, 0, usedReader, 0, resultCounter.size);
        device.queue.submit([enc.finish()]);
        usedReader.mapAsync(GPUMapMode.READ).then(async () => {
            const arr = usedReader.getMappedRange();
            const usedCopy = new Uint32Array(arr);
            const usedElems = usedCopy[0]!;
            usedReader.unmap();
            await queryResultBuffer.mapAsync(GPUMapMode.READ); // .then(() => {
            const times = new BigUint64Array(queryResultBuffer.getMappedRange());
            const gpuTime = Number(times[1]! - times[0]!); // holy crap these are in nanoseconds?? daaamn
            queryResultBuffer.unmap();
            // console.log('SORT OP TOOK: ',gpuTime/1_000_000,'ms')
            resultReader.mapAsync(GPUMapMode.READ).then(() => {
                const resultsArr = resultReader.getMappedRange(0, Math.max(16, usedElems * outputSizeBytes));
                const copy = new Uint32Array(resultsArr.byteLength / 4);
                copy.set(new Uint32Array(resultsArr));
                // console.log("RESULTS!", copy);
                resultReader.unmap();
                // convert the data from raw bytes to our expected table format
                const dv = new DataView(copy.buffer);
                const rows: Array<RowType> = [];
                for (let row = 0; row < usedElems; row++) {
                    rows.push(extractRow(row, dv));
                }
                onFilterComplete(rows, gpuTime / 1_000_000); // divide by 1 million to get to milliseconds from nanoseconds
            });
        });
    };
    return doFilter;
}
