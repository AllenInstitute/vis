import type { WgslShader } from '../shaders';
import type { WgpuResource } from './resources';

export type BindingGraphResourceNode<T = unknown> = {
    __nodeType: 'resource';
    resource: Resource<T>;
    pipelines: BindingGraphPipelineNode[];
    label?: string;
};

export function isBindingGraphResourceNode(value: unknown): value is BindingGraphResourceNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__nodeType' in value &&
        value.__nodeType === 'resource' &&
        'resource' in value &&
        typeof value.resource === 'object' &&
        'pipelines' in value &&
        Array.isArray(value.pipelines)
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
    resources: (WgpuResource | BindingGraphResourceNode)[],
    subgroup?: BindingGraphGroupNode
): BindingGraphGroupNode {
    return {
        __nodeType: 'group',
        label,
        resources: resources.map((r) => (isBindingGraphResourceNode(r) ? r : resource(undefined, r, []))),
        subgroup,
    };
}

export function resource(
    label: string | undefined,
    resource: WgpuResource,
    pipelines: BindingGraphPipelineNode[]
): BindingGraphResourceNode {
    return {
        __nodeType: 'resource',
        label,
        resource,
        pipelines,
    };
}

export function pipeline(
    shader: WgslShader,
    depthStencil?: GPUDepthStencilState,
    multisample?: GPUMultisampleState,
    primitive?: GPUPrimitiveTopology
): BindingGraphPipelineNode {
    return {
        __nodeType: 'pipeline',
        shader,
        depthStencil,
        multisample,
        primitive,
    };
}
