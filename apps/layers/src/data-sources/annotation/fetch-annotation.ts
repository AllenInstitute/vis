import { getAnnotationCodec } from "./annotation-codec";

export async function fetchAnnotation(payload: {
    annotationBaseUrl: string;
    gridFeature: string;
    levelFeature: string;
}) {
    const { annotationBaseUrl, gridFeature, levelFeature } = payload;

    // annotationBaseUrl contains a slash at the end
    const url = new URL(`${annotationBaseUrl}annotation.bin`);

    if (gridFeature) {
        url.searchParams.append('gridFeatureFtvReferenceId', gridFeature);
    }
    if (levelFeature) {
        url.searchParams.append('annotationFeatureReferenceId', levelFeature);
    }

    try {
        const yay = await fetch(url);
        const buffer = await yay.arrayBuffer();
        const codec = getAnnotationCodec();
        if (codec && buffer) {
            const annotation = codec.decodeAnnotation(new Uint8Array(buffer));
            return annotation;
        }
    } finally {
        /* empty */
    }
    return undefined;
}