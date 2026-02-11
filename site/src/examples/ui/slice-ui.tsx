import type { Demo } from '../layers';
export function SliceViewLayer(props: { demo: Demo }) {
    const { demo } = props;
    // control the gamut with some sliders
    const l = demo.layers[demo.selectedLayer];
    if (l && l.type === 'volumeSlice') {
        return (
            <div>
                <label htmlFor="rgb">RGB </label>
                <div>
                    <label>R min: </label>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={l.data.gamut.R.gamut.min}
                        onChange={(e) => {
                            demo.setGamutChannel('R', [Number(e.target.value), l.data.gamut.R.gamut.max]);
                        }}
                    />
                    <label>R max: </label>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={l.data.gamut.R.gamut.max}
                        onChange={(e) => {
                            demo.setGamutChannel('R', [l.data.gamut.R.gamut.min, Number(e.target.value)]);
                        }}
                    />
                </div>
                <div>
                    <label>G min: </label>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={l.data.gamut.G.gamut.min}
                        onChange={(e) => {
                            demo.setGamutChannel('G', [Number(e.target.value), l.data.gamut.G.gamut.max]);
                        }}
                    />
                    <label>G max: </label>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={l.data.gamut.G.gamut.max}
                        onChange={(e) => {
                            demo.setGamutChannel('G', [l.data.gamut.G.gamut.min, Number(e.target.value)]);
                        }}
                    />
                </div>
                <div>
                    <label>B min: </label>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={l.data.gamut.B.gamut.min}
                        onChange={(e) => {
                            demo.setGamutChannel('B', [Number(e.target.value), l.data.gamut.B.gamut.max]);
                        }}
                    />
                    <label>B max: </label>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={l.data.gamut.B.gamut.max}
                        onChange={(e) => {
                            demo.setGamutChannel('B', [l.data.gamut.B.gamut.min, Number(e.target.value)]);
                        }}
                    />
                </div>
                <label htmlFor="slice">Slice </label>
                <input
                    name="slice"
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={l.data.planeParameter}
                    onChange={(e) => {
                        demo.setSlice(Number(e.target.value));
                    }}
                />
                <button key={'xy'} onClick={() => demo.setPlane('xy')}>
                    xy
                </button>
                <button key={'yz'} onClick={() => demo.setPlane('yz')}>
                    yz
                </button>
                <button key={'xz'} onClick={() => demo.setPlane('xz')}>
                    xz
                </button>
            </div>
        );
    }
    return null;
}
