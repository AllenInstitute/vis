import { AnnotationGrid } from '../ui/annotation-grid';
import { ContactSheetUI } from '../ui/contact-sheet';
import { ScatterplotUI } from '../ui/scatterplot-ui';
import { SliceViewLayer } from '../ui/slice-ui';
import type { Demo } from '../layers';
import type { ScatterplotGridConfig } from '../data-sources/scatterplot/dynamic-grid';
import type { ZarrSliceGridConfig } from '../data-sources/ome-zarr/slice-grid';
import type { AnnotationGridConfig } from '../data-sources/annotation/annotation-grid';

type ExampleLayerConfigs = {
    reconstructed: ScatterplotGridConfig;
    structureAnnotation: AnnotationGridConfig;
    tissuecyte396: ZarrSliceGridConfig;
};

export function AppUi(props: { demo: Demo; examples?: ExampleLayerConfigs }) {
    const { demo, examples } = props;
    return (
        <div>
            <div style={{ marginBottom: '8px' }}>
                <button
                    type="button"
                    title="Quick snapshot"
                    onClick={() => {
                        demo.requestSnapshot(3000);
                    }}
                >
                    {'📷'}
                </button>
                <button
                    type="button"
                    title="High-resolution snapshot (~80 MP, slow)"
                    onClick={() => {
                        demo.requestSnapshot(10000);
                    }}
                >
                    {'📸 Hi-Res'}
                </button>
            </div>
            {examples && (
                <fieldset style={{ marginBottom: '8px' }}>
                    <legend>Add Layer</legend>
                    <button
                        type="button"
                        onClick={() => {
                            demo.addLayer(examples.reconstructed);
                        }}
                    >
                        {'🔵 Scatter Plot Grid'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            demo.addLayer(examples.structureAnnotation);
                        }}
                    >
                        {'🗺️ CCF Annotations'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            demo.addLayer(examples.tissuecyte396);
                        }}
                    >
                        {'🔬 Volume Grid'}
                    </button>
                </fieldset>
            )}
            <div>
                <label htmlFor="layer">{`Layer ${demo.selectedLayer}`}</label>
                <button
                    type="button"
                    name="layer"
                    onClick={() => {
                        demo.selectLayer(demo.selectedLayer - 1);
                    }}
                >
                    {'←'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        demo.selectLayer(demo.selectedLayer + 1);
                    }}
                >
                    {'→'}
                </button>
                <button
                    type="button"
                    title="Remove selected layer"
                    onClick={() => {
                        demo.deleteSelectedLayer();
                    }}
                >
                    {'🗑️'}
                </button>
            </div>
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
