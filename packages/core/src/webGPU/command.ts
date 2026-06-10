import keys from 'lodash/keys';
import map from 'lodash/map';
import mapValues from 'lodash/mapValues';
import { match } from 'ts-pattern';
import * as wgh from 'webgpu-utils'

// we could even lock it down a little...
// only one arg allowed, an object with keys
// bindGroups,vertexBuffers,counts
// or perhaps uniforms, textures, storages, vertexBuffers
type Bindings = Record<string, unknown>
type AugmentedPipeline = {
  pipeline: GPURenderPipeline,
  defs: wgh.ShaderDataDefinitions,
}
type BindingState = {
  pipeline: AugmentedPipeline, // not optional - gonna use it to drive type-safety (but thats not in yet)
  uniforms?: Bindings,
  storages?: Bindings,
  textures?: Bindings,
  samplers?: Bindings,
  vertexBuffers?: ReadonlyArray<{buffer:GPUBuffer,offset:number}>,
}
type Group = Record<number, {
  info: wgh.VariableDefinition&{name:string,category:'uniforms' | 'storages' | 'textures' | 'samplers' },
  // { name: string, group: number, binding: number, size: number, typeDefinition: wgh.TypeDefinition, category: 'uniforms' | 'storages' | 'textures' | 'samplers' },
  value: unknown
}>
function organizeIntoGroups(state: BindingState) {
  const { defs } = state.pipeline
  const groups: Record<number, Group> = {}
  for (const category of ['uniforms', 'storages', 'textures', 'samplers'] as const) {
    // all categories are optional...
    if (!(category in state)) {
      continue;
    }
    for (const name in state[category]) {
      // look it up in the def...
      const info = defs[category][name]
      if (!info) {
        // its ok - a thing that is given but not in a pipeline
        // is not necessarily a mistake... sort of.
        // in this case, the way we're doing it, it probably is...
        continue; // TODO
      }
      if (!groups[info.group]) {
        groups[info.group] = {}
      }
      const group = groups[info.group]!;
      group[info.binding]={info:{...info,category,name},value:state[category][name]}
    }
  }
  return groups;
}
function switchPipeline(pass:GPURenderPassEncoder,cur: AugmentedPipeline, prev: AugmentedPipeline | undefined) {
  // use strict equality
  if (cur !== prev) {
    pass.setPipeline(cur.pipeline);
  }
}
function needsUpdate(cur: Group, prev: Group) {
  // return true if any value in cur is missing from prev, or not equal to its prev counterpart
  for (const key in cur) {
    if (cur[key]?.value !== prev[key]?.value) {
      return true;
    }
  }
  return false;
}
function bindGroup(device: GPUDevice,
  createBuffer: (desc:GPUBufferDescriptor)=>GPUBuffer,
  pass: GPURenderPassEncoder, pipe: AugmentedPipeline, groupIndex: number, cur: undefined | Group | GPUBindGroup, prev: Group | GPUBindGroup | undefined) {
  // some easy cases first
  if (prev === cur || cur===undefined) {
    return
  }
  if (cur instanceof GPUBindGroup) {
    pass.setBindGroup(groupIndex, cur);
    return {gpuGroup:cur}
  }
  if (prev instanceof GPUBindGroup || !prev) {
    // cur isnt - we must update
    // update binding must:
    // 1. fetch a new bind-group and new buffers from a pool
    // 2. they have to be of the appropriate type!
    // 3. we need to mark them in a way that lets us reclaim them after the current commands are enqueued.
    // 4. write the values to the resources from the pool,
    // 4. lastly, bind the group
    return updateBinding(device,createBuffer,pass,pipe,groupIndex,cur)
  }
  if (needsUpdate(cur, prev)) {
    return updateBinding(device,createBuffer,pass,pipe,groupIndex,cur)
  }
}
function makePool(device: GPUDevice) {
  // TODO: obviously, this pool is really just a placeholder!
  const outstanding = new Set<GPUBuffer>();
  return {
    requestBuffer: (desc:GPUBufferDescriptor)=>{
      const b = device.createBuffer(desc)
      outstanding.add(b)
      return b;
    },
    reclaim: () => {
      // console.log('reclaim',outstanding.size)
      for (const b of outstanding) {
        b.destroy();
      }
      outstanding.clear()
    }
  }
}
function requestGroupResources(
  device: GPUDevice,
  createBuffer: (desc:GPUBufferDescriptor)=>GPUBuffer,
  group: Group) {
  return mapValues(group, (binding) => {
    return match(binding.info)
      .with({ category: 'storages' }, (def) => {
        if (binding.value instanceof GPUBuffer) {
          return binding.value;
        }
        const b = createBuffer({ size: def.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE })
        const view = wgh.makeStructuredView(def)
        view.set(binding.value);
        device.queue.writeBuffer(b, 0, view.arrayBuffer);
        return b;
      })
      .with({ category: 'uniforms' }, (def) => {
        if (binding.value instanceof GPUBuffer) {
          return binding.value;
        }
        const b = createBuffer({ size: def.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
        const view = wgh.makeStructuredView(def)
        view.set(binding.value);
        device.queue.writeBuffer(b, 0, view.arrayBuffer);
        return b;
      })
      .with({ category: 'samplers' }, () => {
        if (binding.value instanceof GPUSampler) {
          return binding.value;
        }
        throw new Error('we dont support pooled samplers...')
      })
      .with({ category: 'textures' }, () => {
        if (binding.value instanceof GPUTexture || binding.value instanceof GPUTextureView) {
          return binding.value;
        }
        throw new Error('we dont support pooled textures...')
      })
      .otherwise(() => {
        throw new Error(`unsupported group def...${binding.info.name} (${binding.info.category})`)
      })
  })
}
function updateBinding(
  device: GPUDevice,
  createBuffer: (desc:GPUBufferDescriptor)=>GPUBuffer,
  pass: GPURenderPassEncoder,
  pipeline: AugmentedPipeline,
  groupIndex: number,
  group:Group
) {
    // 1. figure out the type(s) for the bindings in the group
  // 2. allocate new ones (get them from a pool please!)
  // TODO:: what if we want to partially update a bind-group?
  // it might be better to re-org this to just get resources for the new thing,
  // then create and cache a bind-group for it.
  const resources = requestGroupResources(device,createBuffer, group);
  // TODO: as written, this leaks resources all the time
  // how shall we retrieve them?
    // 3. write to the buffers
    // todo it does make more sense to write the buffers in the request fn...
    // 4. bind the new bindgroup, return it
    const bindings = map(keys(resources), (b) => ({binding:Number(b),resource:resources[Number(b)]!}))
    const bg = device.createBindGroup({
      layout: pipeline.pipeline.getBindGroupLayout(groupIndex), entries: bindings
    })
  pass.setBindGroup(groupIndex, bg);
  return {gpuGroup:bg, group}
  }

export function createRecorder(device:GPUDevice,pass:GPURenderPassEncoder) {
  let previous:BindingState | undefined;
  let prior: Record<number, {
    group?: Group | undefined,
    gpuGroup: GPUBindGroup,
  }> = {}
  const pool = makePool(device);

  function draw(
    bindings:BindingState,
    bindGroupOverrides: Record<number, GPUBindGroup>,
    count: number,
    instances?: number,
  ) {
    const { pipeline } = bindings;
    const grouping = organizeIntoGroups(bindings);

    switchPipeline(pass, pipeline, previous?.pipeline)
    for (let i = 0; i < 4; i++){// todo use max bindgroup limit instead of 4
      const r = bindGroup(device,pool.requestBuffer, pass, pipeline, i, bindGroupOverrides?.[i] ?? grouping[i], prior[i]?.group ?? prior[i]?.gpuGroup)
      if (r) {
        prior[i]=r
      }
    }
    // phew now the easy part - vertex buffers dont need bindings
    if (bindings.vertexBuffers) {
      for (let i = 0; i < bindings.vertexBuffers.length; i++){
        const vbo = bindings.vertexBuffers[i];
        if (vbo && vbo !== previous?.vertexBuffers?.[i]) {
          pass.setVertexBuffer(i, vbo.buffer,vbo.offset);
        }
      }
    }
    pass.draw(count, instances); // todo: other draw-types (indexed, indirect,etc...)
    previous = bindings;
  }
  return {draw,cleanup:pool.reclaim};
}
