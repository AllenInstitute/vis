// AGGREGATE STUFF!
var<workgroup> results: array<${structName},${workgroupSize}>;
var<workgroup> locations: array<${vec2u},${workgroupSize}>;
var<workgroup> count: atomic<u32>;

// an array of 1... because this is a storage buffer? hmmmm not sure
@group(0) @binding(0) var<uniform> dimensions:vec2u; // Nx1 in the 1D case

// result count and results are in group1, as they change at the same rate as the input buffers
${indexed ? '@group(1) @binding(2) var<storage, read_write> elements: array<u32>;' : ''};

${inputBindings}
${outputBindings} // cant use a single structure, because atomics!
@compute @workgroup_size(${workgroupSize})

// each thread will write to its own outputStruct in the results array
// after all threads finish this task, which requires no sync at all,
// each thread will be given a range of rows
// all threads read all local results, and copy results who's locations match
fn main(
    @builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
){
    let element = ${indexed ? 'elements[global_id.x]' : 'global_id.x'};
    let aggregate = ${aggregateExpr};
    let row = ${rowExpr};
    let col = ${colExpr};
    results[local_id.x]=aggregate;
    locations[local_id.x]=vec2u(col,row);

    workgroupBarrier();
    // each thread gets an array of COLS (as often rows are just 1)
    let colsPerThread = max(1u,(dimensions.x/${workgroupSize}));
    // my row range = local_id.x
    let colStart = local_id.x*colsPerThread;
    var colEnd = colStart+colsPerThread;
    if(local_id.x==${workgroupSize}-1){
        colEnd = dimensions.x;
    }
    // ok!
    for(let i =0;i<${workgroupSize};i++){
        if(locations[i].x >= colStart && locations[i].x < colEnd){
            // atomically write the structure... which is hard... because you cant do that...
            let tmp = results[i];
            let loc = locations[i];
            // technically... we could merge our results here first...
            // a cost of workgroup^2..., that drops atomic accesses dramatically in the worst case...
            // except we dont know what pairs merge, and if they dont its a drop..
            // every thread could read all other results, and merge them with its own
            // if the other is < than my id, skip it, and delete my result? and stop?
            // we'd need an extra buffer so as not to conflict on reads...

            // well that can be a cool improvement later...

            // also atomics cant be f32
            // we could use bitcast to cast them to floats, do the op, then put the new value back...
            ${globalAtomicAggregate};
        }
    }
}
