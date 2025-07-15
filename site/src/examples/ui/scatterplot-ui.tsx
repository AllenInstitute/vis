import { InputSlider } from '@czi-sds/components';
import type { Demo } from '../layers';
export function ScatterplotUI(props: { demo: Demo }) {
    const { demo } = props;
    // control the gamut with some sliders
    const l = demo.layers[demo.selectedLayer];

    if ((l && l.type === 'scatterplot') || l.type === 'scatterplotGrid') {
        return (
            <div>
                <label htmlFor="point-size">point size</label>
                <InputSlider
                    name="point-size"
                    min={0.5}
                    max={20}
                    step={0.001}
                    value={l.data.pointSize}
                    onChange={(_e, value) => {
                        demo.setPointSize(value as number);
                    }}
                />
                <label htmlFor="color-by">{`Color By Gene (by index: ${l.data.colorBy.name})`}</label>
                <InputSlider
                    name="color-by"
                    min={0}
                    max={400}
                    step={1}
                    value={Number(l.data.colorBy.name)}
                    onChange={(_e, value) => {
                        demo.setColorByIndex(value as number);
                    }}
                />
            </div>
        );
    }
    return null;
}
