
// because the webGL and webGPU implementations of these renderers are very similar,
// they end up having identical names for the same conceptual parts - 
// so lets export them namespaced
import * as WGL from './renderer'
export const WebGL = {
    ...WGL
}