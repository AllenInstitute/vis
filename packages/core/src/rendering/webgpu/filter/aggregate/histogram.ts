/*
so for very annoying reasons, that do kinda make sense,
a compute shader might not work well for our aggregation aspirations:

1. workgroup memory is limited - and we are going to be aggregating large heatmaps.
-- if we wanted to put a local histogram/heatmap in workgroup memory, it would be limited to 16K bytes, certainly too limiting in general
2. spinlock-based aggregation seems to be non-portable - it works fine on my laptop, but very flaky on my desktop.
3. a multi-pass, tree-based accumulation system is probably the best (compute-based) option, however its rather complicated, and requires substantial extra memory
4. in the face of all this - a render shader that uses blending for accumulation seems like the best choice
  - the shader will be short and simple, with no atomic nonsense.
  - no extra memory needed
  - we should be able to accumulate ints or floats, and min/max/sum/count are all available to us
  - a downside - it wont be possible to accumulate min(X) and sum(Y) in the same pass - because the operation is performed via fixed-fn blending
*/

import type { ScalarType } from '../types';

export function generateHistogramShader(args: {
    rowGroupExpr: string;
    colGroupExpr: string;
    inputBindings: string;
    aggregationExpr: string;
    aggComponents: 1 | 2 | 3 | 4;
    aggType: ScalarType;
}) {
    const { rowGroupExpr, colGroupExpr, aggComponents, aggregationExpr, inputBindings, aggType } = args;
    const cmpType = aggType === 'u32' ? 'u' : aggType === 'f32' ? 'f' : 'i';
    const wgslOutputType = aggComponents > 1 ? `vec${aggComponents}${cmpType}` : aggType;
    const code = /* wgsl */ `
      struct VsIn {
          @builtin(vertex_index) vIndex: u32,
          // delightfully, we dont need instancing! this is because 1px dots are completely fine in this scenaro! yay!
      };
      struct VsOut {
          @builtin(position) pos: vec4f,
          @location(0) @interpolate(flat) value:${wgslOutputType},
      };
      @group(0) @binding(0)
      var<uniform> outputDimensions: vec2u;

      ${inputBindings}

      @vertex
      fn vmain(v:VsIn)-> VsOut  {
          var out:VsOut;
          let element = v.vIndex;
          let row = ${rowGroupExpr};
          let col = ${colGroupExpr};
          let size = outputDimensions;
          // convert the integer positions into output (clip) space:
          let pos = (vec2f(vec2u(col,row))+vec2f(0.5,0.5))/vec2f(size);
          // pos is now in unit space, relative to camera, coodinates at the center of pixels
          let clip = (pos*2.0)-1.0;
          // upside down please, to match texture memory origin, rather than 'screen origin'
          out.pos = vec4f(clip*vec2f(1.0,-1.0),0.5,1.0);
          // now gather the values that the blending-stage will aggregate:
          out.value = ${aggregationExpr};

          return out;
      }

      @fragment
      fn fmain(v:VsOut) ->@location(0) ${wgslOutputType} {
          return v.value;
      }
    `;
    return code;
}
