import { Button, InputSlider } from '@czi-sds/components';
import type { Demo } from '../layers';
export function ContactSheetUI(props: { demo: Demo }) {
    const { demo } = props;
    // control the gamut with some sliders
    const l = demo.layers[demo.selectedLayer];
    if (l && l.type === 'volumeGrid') {
        return (
            <div>
                <label htmlFor="rgb">RGB </label>
                <InputSlider
                    name="rgb"
                    min={0}
                    max={1000}
                    value={[l.data.gamut.R.gamut.min, l.data.gamut.R.gamut.max]}
                    onChange={(e, value) => {
                        demo.setGamutChannel('R', value as number[]);
                    }}
                />
                <InputSlider
                    min={0}
                    max={1000}
                    value={[l.data.gamut.G.gamut.min, l.data.gamut.G.gamut.max]}
                    onChange={(e, value) => {
                        demo.setGamutChannel('G', value as number[]);
                    }}
                />
                <InputSlider
                    min={0}
                    max={1000}
                    value={[l.data.gamut.B.gamut.min, l.data.gamut.B.gamut.max]}
                    onChange={(e, value) => {
                        demo.setGamutChannel('B', value as number[]);
                    }}
                />
                <Button key={'xy'} onClick={() => demo.setPlane('xy')}>
                    xy
                </Button>
                <Button key={'yz'} onClick={() => demo.setPlane('yz')}>
                    yz
                </Button>
                <Button key={'xz'} onClick={() => demo.setPlane('xz')}>
                    xz
                </Button>
            </div>
        );
    }
    return null;
}
