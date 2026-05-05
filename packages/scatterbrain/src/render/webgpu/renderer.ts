/** biome-ignore-all lint/performance/noAccumulatingSpread: leave me be */
import type { Cacheable, SharedPriorityCache } from '@alleninstitute/vis-core';
import { Box2D, type box2D, type vec2, type vec4 } from '@alleninstitute/vis-geometry';
import { buildScatterbrainCacheClient } from '~/src/cache-client';
import { getVisibleItems, type NodeWithBounds } from '~/src/dataset';
import type { ColumnRequest, ScatterbrainDataset, SlideviewScatterbrainDataset, WebGLSafeBasicType } from '~/src/types';
import { buildPipeline, type Config, type Uniforms } from './shader';
import { beginValidate, endValidate } from './validate';

export { setCategoricalLookupTableValues, updateCategoricalValue } from './lookup-texture';


export type Head<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never : T[0];
export type Tail<T extends ReadonlyArray<unknown>> = T extends readonly [infer _I, ...infer rest] ? rest : never;
export type Last<T extends ReadonlyArray<unknown>> = T extends readonly [infer K] ? K : Last<Tail<T>>;

export type OR<T extends ReadonlyArray<unknown>> = T extends readonly [infer K] ? K : Head<T> | OR<Tail<T>>;

// todo figure out why parcel cant bundle lodash...
function omit<T extends Record<string, unknown>, Drop extends ReadonlyArray<keyof T>>(obj: T, ...drop: Drop): Omit<T, OR<Drop>> {
    const stuff = { ...obj };
    for (const d of drop) {
        delete stuff[d]
    }
    return stuff;
}
export type ShaderSettings = {
    dataset: ScatterbrainDataset | SlideviewScatterbrainDataset;
    categoricalFilters: Record<string, number>; // category name -> maximum # of distinct values in that category
    quantitativeFilters: readonly string[]; // the names of quantitative variables
    mode: 'color' | 'info';
    colorBy:
    | { kind: 'metadata'; column: string }
    | { kind: 'quantitative'; column: string };
    highlightByColumn: { kind: 'quantitative' | 'metadata'; column: string };
};

export class VBO implements Cacheable {
    constructor(readonly buffer: GPUBuffer) { }
    destroy() {
        this.buffer.destroy();
    }
    sizeInBytes() {
        return this.buffer.size;
    }
}

function columnsForItem<T extends object>(
    config: Config,
    col2shader: Record<string, string>,
    dataset: ScatterbrainDataset | SlideviewScatterbrainDataset,
) {
    const columns: Record<string, ColumnRequest> = {};
    const s2c = Object.keys(col2shader).reduce(
        (acc, col) => ({ ...acc, [col2shader[col]]: col }),
        {} as Record<string, string>,
    );

    for (const c of config.categoricalColumns) {
        columns[c] = { type: 'METADATA', name: s2c[c] };
    }
    for (const m of config.quantitativeColumns) {
        columns[m] = { type: 'QUANTITATIVE', name: s2c[m] };
    }
    columns[config.positionColumn] = { type: 'METADATA', name: dataset.metadata.spatialColumn };
    return (item: T) => {
        return { ...item, dataset, columns };
    };
}

export function buildRenderFrameFn(device: GPUDevice, settings: ShaderSettings) {
    const { dataset } = settings;
    const { config, columnNameToShaderName } = configureShader(settings);
    const { pipeline, makeUniformBuffer, updateUniforms, uniformSize } = buildPipeline(device, config);
    const prepareQtCell = columnsForItem<NodeWithBounds>(config, columnNameToShaderName, dataset);

    const toGpuBuffer = (buffer: ArrayBuffer, type: WebGLSafeBasicType) => {
        if (type === 'uint16') {
            // seems like uint16 is cursed - vertex buffers have to have a stride of at least 4...
            const B = device.createBuffer({
                size: buffer.byteLength * 2,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
            });
            // now we have to copy the uint16 buffer and sorta kinda expand each value...
            const u32 = new Uint32Array(new Uint16Array(buffer));
            device.queue.writeBuffer(B, 0, u32.buffer);
            return new VBO(B);
        }
        const B = device.createBuffer({
            size: buffer.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
        });
        device.queue.writeBuffer(B, 0, buffer, 0, buffer.byteLength);
        return new VBO(B);
    };
    const connectToCache = (cache: SharedPriorityCache, onDataArrived: () => void) => {
        const allColumns = [...config.categoricalColumns, ...config.quantitativeColumns, config.positionColumn];
        const client = buildScatterbrainCacheClient<VBO>(allColumns, cache, toGpuBuffer, onDataArrived);
        return client;
    };
    const viridis = new Uint8Array(256 * 4);
    // ugh todo
    for (let i = 0; i < 256; i += 1) {
        viridis[i * 4 + 0] = i;
        viridis[i * 4 + 1] = i;
        viridis[i * 4 + 2] = i;
        viridis[i * 4 + 3] = 255;
    }
    const unis = makeUniformBuffer();
    const ubo = device.createBuffer({
        size: uniformSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        label: 'scatterbrin uniform buffer',
    });
    const render = (props: RenderPassProps & { client: ReturnType<typeof buildScatterbrainCacheClient<VBO>> }) => {
        const { target, camera, offset, filteredOutColor, spatialFilterBox, quantitativeRangeFilters, highlightedValue, client,
            categoricalLookupTable, gradient } = props;
        const uniforms: Uniforms = {
            view: Box2D.toFlatArray(camera.view),
            offset,
            filteredOutColor,
            highlightColor: [1, 1, 0, 1],
            screenSize: camera.screenResolution,
            spatialFilterBox: Box2D.toFlatArray(spatialFilterBox),
            highlightValue: highlightedValue,
            ...quantitativeRangeFilters
        }
        beginValidate(device);

        // we know how many columns are gonna be filtered... because we have a closure over the settings
        // thats "fine" because this renderer already cant be applied a different set of columns, nor a different dataset...

        // const bg0 = updateUniforms({
        //     ...omit(uniforms, 'camera', 'spatialFilterBox', 'quantitativeRangeFilters'),
        //     view: Box2D.toFlatArray(uniforms.camera.view),
        //     spatialFilterBox: Box2D.toFlatArray(uniforms.spatialFilterBox),
        //     ...uniforms.quantitativeRangeFilters,
        // });
        // const bg1 = updateCategorical(categories);
        // const bg2 = updateGradient(viridis); // todo - dont do this every frame...

        // unlike the textures... we'd like to not make our user handle raw buffers...
        // but perhaps that is silly
        updateUniforms(uniforms, unis);
        // it would be... very slightly better if we could not do this for every single node in the quadtree - but
        // thats a future thing TODO
        device.queue.writeBuffer(ubo, 0, unis.arrayBuffer);
        const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: ubo }];
        if (Object.keys(Object.keys(settings.categoricalFilters)).length > 0) {
            entries.push({ binding: 1, resource: categoricalLookupTable });
        }
        if (Object.keys(quantitativeRangeFilters).length > 0) {
            entries.push({ binding: 2, resource: gradient });
        }
        const bg = device.createBindGroup({
            label: 'single bg',
            entries,
            layout: pipeline.getBindGroupLayout(0),
        });
        const enc = device.createCommandEncoder({ label: 'encoder for scatterbrain render pass' });
        const pass = enc.beginRenderPass({
            colorAttachments: [
                {
                    clearValue: [0, 0, 0.15, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                    view: target,
                },
            ],
        });
        pass.setPipeline(pipeline);

        pass.setBindGroup(0, bg);

        // now - actually start submitting stuff
        const visible = getVisibleItems(dataset, camera, 0.1).map(prepareQtCell);
        client.setPriorities(visible, []);
        // console.log('visible: ', visible.length)
        for (const node of visible) {
            if (client.has(node)) {
                const drawable = client.get(node);
                if (drawable) {
                    const columns = drawable;
                    const count = node.node.numSpecimens;
                    for (let i = 0; i < config.vertexLocationOrder.length; i++) {
                        pass.setVertexBuffer(i, columns[config.vertexLocationOrder[i]].buffer);
                    }
                    //bind all the vbo...
                    // with the correct dang locations, ugh
                    pass.draw(4, count);
                }
            }
        }
        pass.end();
        device.queue.submit([enc.finish()]);
        endValidate(device);
    };
    return { render, connectToCache, makeUniformBuffer, pipeline, updateUniforms };
}

export type RenderPassProps = {
    target: GPUTextureView;

    camera: { view: box2D; screenResolution: vec2 };
    offset: vec2;
    filteredOutColor: vec4;
    spatialFilterBox: box2D;
    quantitativeRangeFilters: Record<string, vec2>;
    highlightedValue: number;
    categoricalLookupTable: GPUTextureView;
    gradient: GPUTextureView;
};

export function configureShader(settings: ShaderSettings): {
    config: Config;
    columnNameToShaderName: Record<string, string>;
} {
    // given settings that make sense to a caller (stuff about the data we want to visualize)
    // produce an object that can be used to set up some internal config of the shader that would
    // do the visualization
    const { dataset, categoricalFilters, quantitativeFilters, colorBy, mode, highlightByColumn } = settings;
    // figure out the columns we care about
    // assign them names that are safe to use in the shader (A,B,C, whatever)
    const categories = Object.keys(categoricalFilters).toSorted();

    // the goal here is to associate column names with shader-safe names
    const initialQuantitativeAttrs: Record<string, string> =
        colorBy.kind === 'metadata' ? {} : { [colorBy.column]: 'COLOR_BY_MEASURE' };
    const initialCategoricalAttrs: Record<string, string> =
        colorBy.kind === 'metadata' ? { [colorBy.column]: 'COLOR_BY_CATEGORY' } : {};
    // we map each quantitative filter name to the shader-safe attribute name: MEASURE_{i}
    const qAttrs = quantitativeFilters.toSorted().reduce(
        (quantAttrs, quantFilter, i) => ({ ...quantAttrs, [quantFilter]: `MEASURE_${i.toFixed(0)}` }),
        initialQuantitativeAttrs,
    );
    // we map each categorical filter's name to the shader-safe attribute name: CATEGORY_{i}
    const cAttrs = categories.reduce(
        (catAttrs, categoricalFilter, i) => ({ ...catAttrs, [categoricalFilter]: `CATEGORY_${i.toFixed(0)}` }),
        initialCategoricalAttrs,
    );

    const colToAttribute = {
        ...qAttrs,
        ...cAttrs,
        [dataset.metadata.spatialColumn]: 'position',
    };
    const ordered = [...categories, ...quantitativeFilters.toSorted()].map((col) => colToAttribute[col]);
    const config: Config = {
        categoricalColumns: Object.keys(cAttrs).map((columnName) => colToAttribute[columnName]),
        quantitativeColumns: Object.keys(qAttrs).map((columnName) => colToAttribute[columnName]),
        categoricalTable: 'lookup',
        gradientTable: 'gradient',
        colorByColumn: colToAttribute[colorBy.column],
        mode,
        positionColumn: 'position',
        highlightByColumn: { ...highlightByColumn, column: colToAttribute[highlightByColumn.column] },
        vertexLocationOrder: ['position', ...ordered],
    };
    return { config, columnNameToShaderName: colToAttribute };
}
