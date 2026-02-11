import type { Demo } from '../layers';
export function AnnotationGrid(props: { demo: Demo }) {
    const { demo } = props;
    // control the gamut with some sliders
    const l = demo.layers[demo.selectedLayer];
    if (l && l.type === 'annotationGrid') {
        return (
            <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={l.data.fill.opacity}
                onChange={(e) => {
                    demo.setOpacity('fill', Number(e.target.value));
                }}
            />
        );
    }
    return null;
}
