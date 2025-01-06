import type { DziImage } from '@alleninstitute/vis-dzi';
import type { vec2 } from '@alleninstitute/vis-geometry';
import { useEffect, useState } from 'react';

interface useDziImageProps {
    imageUrls: string[];
    onComplete?: (imgSize: vec2) => void;
}

function decodeDzi(s: string, url: string): DziImage | undefined {
    const parser = new DOMParser();
    const doc = parser.parseFromString(s, 'text/xml');
    const err = doc.querySelector('Error');
    if (err) return undefined;

    if (doc) {
        const img = doc.getElementsByTagName('Image')[0];
        const size = doc.getElementsByTagName('Size')?.[0];
        const [format, overlap, tileSize] = [
            img.getAttribute('Format'),
            img.getAttribute('Overlap'),
            img.getAttribute('TileSize'),
        ];
        if (size && format && overlap && tileSize) {
            const width = size.getAttribute('Width');
            const height = size.getAttribute('Height');
            const splits = url.split('.dzi');
            if (width && height && splits) {
                return {
                    imagesUrl: `${splits?.[0]}_files/`,
                    format: format as 'jpeg' | 'png' | 'jpg' | 'JPG' | 'PNG',
                    overlap: Number.parseInt(overlap, 10),
                    tileSize: Number.parseInt(tileSize, 10),
                    size: {
                        width: Number.parseInt(width, 10),
                        height: Number.parseInt(height, 10),
                    },
                };
            }
        }
    }
    return undefined;
}

async function getImages(urls: string[], callback: (images: Array<DziImage | undefined>) => void) {
    const images = await Promise.all(
        urls.map(async (v) =>
            fetch(v)
                .then((res) => {
                    console.log(res);
                    return res.text();
                })
                .then((s) => decodeDzi(s, v))
        )
    );

    callback(images);
}

export function useDziImages({ imageUrls, onComplete }: useDziImageProps) {
    const [loading, setLoading] = useState(false);
    const [images, setImages] = useState<DziImage[]>([]);

    useEffect(() => {
        setImages([]);
        setLoading(true);
        const updateImages = (data: Array<DziImage | undefined>) => {
            setImages(data.filter((v) => v !== undefined));
            setLoading(false);

            // only fire the on complete if we have an image to give a size for
            if (data[0]?.size) {
                onComplete?.([data[0].size.width, data[0].size.height]);
            }
        };
        getImages(imageUrls, updateImages);
    }, [imageUrls, onComplete]);

    return { images, loading };
}
