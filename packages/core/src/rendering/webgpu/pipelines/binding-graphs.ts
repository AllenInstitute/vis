import type { ShaderStageFlags } from '../native-types';
import type { Resource } from '../resources';
import type { WgslShader } from '../shaders';
import type { ResourceData } from './resources';

/**
 * A resource node in the binding graph. Pairs a metadata-only `Resource` *descriptor* (used to
 * generate the WGSL declaration and to populate the `GPUBindGroupLayoutEntry`) with the concrete
 * `ResourceData` (the actual GPU object that backs `GPUBindGroupEntry.resource`).
 */
export type BindingGraphResourceNode = {
    __nodeType: 'resource';
    /** Metadata-only descriptor; used by binding-graph traversal to produce the BGL entry and to
     *  generate the WGSL declaration once a `{group, binding}` is assigned. */
    descriptor: Resource;
    /** The concrete GPU object that will populate the bind-group entry at draw time. */
    gpu: ResourceData;
    /** Pipelines that reference this resource. The union of their `stages` drives visibility. */
    pipelines: BindingGraphPipelineNode[];
    label?: string;
};

export function isBindingGraphResourceNode(value: unknown): value is BindingGraphResourceNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__nodeType' in value &&
        value.__nodeType === 'resource' &&
        'descriptor' in value &&
        'gpu' in value &&
        'pipelines' in value &&
        Array.isArray((value as { pipelines: unknown }).pipelines)
    );
}

export type BindingGraphGroupNode = {
    __nodeType: 'group';
    resources: BindingGraphResourceNode[];
    subgroup?: BindingGraphGroupNode;
    label?: string;
};

export type BindingGraphPipelineNode = {
    __nodeType: 'pipeline';
    shader: WgslShader;
    /** Shader stages this pipeline contributes to. Unioned per-resource by traversal to compute
     *  `GPUBindGroupLayoutEntry.visibility`. If omitted, traversal falls back to the resource's
     *  own `visibility` field (or defaults to all stages when neither is set). */
    stages?: ShaderStageFlags;
    depthStencil?: GPUDepthStencilState;
    multisample?: GPUMultisampleState;
    primitive?: GPUPrimitiveTopology;
    label?: string;
};

export type BindingGraph = {
    groups: BindingGraphGroupNode[];
};

function recursivelyCheckGroup(group: BindingGraphGroupNode, depth: number, depthLimit: number): boolean {
    if (depth > depthLimit) {
        return false;
    }
    if (group.subgroup) {
        if (!recursivelyCheckGroup(group.subgroup, depth + 1, depthLimit)) {
            return false;
        }
    }
    return true;
}

function checkGroupDepth(groups: BindingGraphGroupNode[], depthLimit: number): boolean {
    for (const group of groups) {
        if (group.__nodeType !== 'group') {
            throw new Error('expected group node');
        }
        if (!recursivelyCheckGroup(group, 1, depthLimit)) {
            return false;
        }
    }
    return true;
}

export function makeBindingGraph(groups: BindingGraphGroupNode[], groupDepthLimit = 4): BindingGraph {
    if (groupDepthLimit > 0) {
        if (!checkGroupDepth(groups, groupDepthLimit)) {
            throw new Error(`binding graph group depth exceeds the limit of ${groupDepthLimit}`);
        }
    }
    return { groups };
}

export function isBindingGraph(value: unknown): value is BindingGraph {
    return typeof value === 'object' && value !== null && 'groups' in value && Array.isArray(value.groups);
}

export function group(
    label: string | undefined,
    resources: BindingGraphResourceNode[],
    subgroup?: BindingGraphGroupNode
): BindingGraphGroupNode {
    return {
        __nodeType: 'group',
        label,
        resources,
        subgroup,
    };
}

export function resource(
    label: string | undefined,
    descriptor: Resource,
    gpu: ResourceData,
    pipelines: BindingGraphPipelineNode[]
): BindingGraphResourceNode {
    return {
        __nodeType: 'resource',
        label,
        descriptor,
        gpu,
        pipelines,
    };
}

export function pipeline(
    shader: WgslShader,
    options: {
        stages?: ShaderStageFlags;
        depthStencil?: GPUDepthStencilState;
        multisample?: GPUMultisampleState;
        primitive?: GPUPrimitiveTopology;
        label?: string;
    } = {}
): BindingGraphPipelineNode {
    return {
        __nodeType: 'pipeline',
        shader,
        ...options,
    };
}
