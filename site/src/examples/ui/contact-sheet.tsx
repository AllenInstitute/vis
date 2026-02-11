import type { Demo } from '../layers';
export function ContactSheetUI(props: { demo: Demo }) {
    const { demo } = props;
    // control the gamut with some sliders
    const l = demo.layers[demo.selectedLayer];
    if (l && l.type === 'volumeGrid') {
        return (
            <div>
                <label htmlFor="rgb">RGB </label>
                <div>
                    <label>
                        R min:
                        <input
                            type="range"
                            min={0}
                            max={1000}
                            value={l.data.gamut.R.gamut.min}
                            onChange={(e) => {
                                demo.setGamutChannel('R', [Number(e.target.value), l.data.gamut.R.gamut.max]);
                            }}
                        />
                    </label>
                    <label>
                        R max:
                        <input
                            type="range"
                            min={0}
                            max={1000}
                            value={l.data.gamut.R.gamut.max}
                            onChange={(e) => {
                                demo.setGamutChannel('R', [l.data.gamut.R.gamut.min, Number(e.target.value)]);
                            }}
                        />
                    </label>
                </div>
                <div>
                    <label>
                        G min:
                        <input
                            type="range"
                            min={0}
                            max={1000}
                            value={l.data.gamut.G.gamut.min}
                            onChange={(e) => {
                                demo.setGamutChannel('G', [Number(e.target.value), l.data.gamut.G.gamut.max]);
                            }}
                        />
                    </label>
                    <label>
                        G max:
                        <input
                            type="range"
                            min={0}
                            max={1000}
                            value={l.data.gamut.G.gamut.max}
                            onChange={(e) => {
                                demo.setGamutChannel('G', [l.data.gamut.G.gamut.min, Number(e.target.value)]);
                            }}
                        />
                    </label>
                </div>
                <div>
                    <label>
                        B min:
                        <input
                            type="range"
                            min={0}
                            max={1000}
                            value={l.data.gamut.B.gamut.min}
                            onChange={(e) => {
                                demo.setGamutChannel('B', [Number(e.target.value), l.data.gamut.B.gamut.max]);
                            }}
                        />
                    </label>
                    <label>
                        B max:
                        <input
                            type="range"
                            min={0}
                            max={1000}
                            value={l.data.gamut.B.gamut.max}
                            onChange={(e) => {
                                demo.setGamutChannel('B', [l.data.gamut.B.gamut.min, Number(e.target.value)]);
                            }}
                        />
                    </label>
                </div>
                <button type="button" key={'xy'} onClick={() => demo.setPlane('xy')}>
                    xy
                </button>
                <button type="button" key={'yz'} onClick={() => demo.setPlane('yz')}>
                    yz
                </button>
                <button type="button" key={'xz'} onClick={() => demo.setPlane('xz')}>
                    xz
                </button>
            </div>
        );
    }
    return null;
}
