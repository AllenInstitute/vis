export type PipelineGraph = {
    groups: GroupNode[];
}

const x: GPUBufferUsageFlags;

export type Node = GroupNode | BindingNode;

export type GroupNode = {
    type: 'group';
    bindings: BindingNode[];
    subgroups?: GroupNode[];
};

export type BindingNode = {
    type: 'binding';
} & ({
    resourceType: 'uniform';
} | {
    resourceType: 'storage';
} | {
    resourceType: 'sampler';
} | {
    resourceType: 'texture';
});

