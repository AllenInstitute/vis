import type { Demo } from '../layers';
export function ScatterplotUI(props: { demo: Demo }) {
    const { demo } = props;
    // control the gamut with some sliders
    const l = demo.layers[demo.selectedLayer];

    if ((l && l.type === 'scatterplot') || l.type === 'scatterplotGrid') {
        return (
            <div>
                <label htmlFor="point-size">point size</label>
                <input
                    name="point-size"
                    type="range"
                    min={0.5}
                    max={20}
                    step={0.001}
                    value={l.data.pointSize}
                    onChange={(e) => {
                        demo.setPointSize(Number(e.target.value));
                    }}
                />
                <label htmlFor="color-by">{`Color By Gene (by index: ${l.data.colorBy.name})`}</label>
                <input
                    name="color-by"
                    type="range"
                    min={0}
                    max={400}
                    step={1}
                    value={Number(l.data.colorBy.name)}
                    onChange={(e) => {
                        demo.setColorByIndex(Number(e.target.value));
                    }}
                />
            </div>
        );
    }
    return null;
}
