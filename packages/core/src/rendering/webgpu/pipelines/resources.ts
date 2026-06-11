export type ResourceData =
    | {
          texture: GPUTexture;
      }
    | {
          buffer: GPUBuffer;
      }
    | {
          sampler: GPUSampler;
      };

/*
What do we need to know about resources at the start?


BindGroupLayout
- `binding` is obviously going to be set the bindinggraph traversal
- the `visibility` parameter will be determined by which shader stages are present in the pipeline(s) that use(s) that resource
- Resource Layout objects
    - buffer
        - type (optional, default: "uniform")
            - uniform
            - read-only-storage
            - storage
        - hasDynamicOffset (optional)
        - minBindingSize (optional)
            = can be specified in Resource definition
            = maybe calculatable by shader code/webgpu-utils?
    - externalTexture
        = no properties
    - storageTexture
        - access (optional, default: "write-only")
            - read-only
            - read-write
            - write-only
        - format
        - viewDimension (optional, default: "2d")
            - 1d
            - 2d
            - 2d-array
            - cube
            - cube-array
            - 3d
    - texture
        - multisampled (optional, default: false)
        - sampleType (optional, default: "float")
            - depth
            - float
            - sint
            - uint
            - unfilterable-float
        - viewDimension (optional, default: "2d")
            - 1d
            - 2d
            - 2d-array
            - cube
            - cube-array
            - 3d
    - sampler
        - type (optional, default: "filtering")
            - comparison
            - filtering
            - non-filtering


*/
