import { AnnotationGrid } from '../ui/annotation-grid';
import { ContactSheetUI } from '../ui/contact-sheet';
import { ScatterplotUI } from '../ui/scatterplot-ui';
import { SliceViewLayer } from '../ui/slice-ui';
import type { Demo } from '../layers';

export function AppUi(props: { demo: Demo }) {
    const { demo } = props;
    return (
        <div>
            <button
                onClick={() => {
                    demo.requestSnapshot(3000);
                }}
            >
                {'📷'}
            </button>
            <label htmlFor="layer">{`Layer ${demo.selectedLayer}`}</label>
            <button
                name="layer"
                onClick={() => {
                    demo.selectLayer(demo.selectedLayer - 1);
                }}
            >
                {'<-'}
            </button>
            <button
                onClick={() => {
                    demo.selectLayer(demo.selectedLayer + 1);
                }}
            >
                {'->'}
            </button>
            <LayerUi demo={demo} />
        </div>
    );
}
function LayerUi(props: { demo: Demo }) {
    const { demo } = props;
    const layer = demo.layers[demo.selectedLayer];
    if (layer) {
        switch (layer.type) {
            case 'annotationGrid':
                return <AnnotationGrid demo={demo} />;
            case 'volumeGrid':
                return <ContactSheetUI demo={demo} />;
            case 'volumeSlice':
                return <SliceViewLayer demo={demo} />;
            case 'scatterplot':
            case 'scatterplotGrid':
                return <ScatterplotUI demo={demo} />;
            default:
                return null;
        }
    }
    return <SliceViewLayer demo={props.demo} />;
}
