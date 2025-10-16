import { OmeZarrMetadata } from "../zarr/metadata";

export const exampleOmeZarr: OmeZarrMetadata = new OmeZarrMetadata(
    new URL('https://allen-genetic-tools.s3.us-west-2.amazonaws.com/tissuecyte/1263343692/ome-zarr/'),
    {
        nodeType: 'group',
        zarrFormat: 3,
        attributes: {
            multiscales: [
                {
                    name: 'test',
                    version: '2',
                    axes: [
                        {
                            name: 'c',
                            type: 'channel',
                            unit: 'millimeter',
                        },
                        {
                            name: 'z',
                            type: 'space',
                            unit: 'millimeter',
                        },
                        {
                            name: 'y',
                            type: 'space',
                            unit: 'millimeter',
                        },
                        {
                            name: 'x',
                            type: 'space',
                            unit: 'millimeter',
                        },
                    ],
                    datasets: [
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.00035, 0.00035],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0, 0],
                                    type: 'translation',
                                },
                            ],
                            path: '0',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0007, 0.0007],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00035, 0.00035],
                                    type: 'translation',
                                },
                            ],
                            path: '1',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0014, 0.0014],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00105, 0.00105],
                                    type: 'translation',
                                },
                            ],
                            path: '2',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0028, 0.0028],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00245, 0.00245],
                                    type: 'translation',
                                },
                            ],
                            path: '3',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0056, 0.0056],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00525, 0.00525],
                                    type: 'translation',
                                },
                            ],
                            path: '4',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0112, 0.0112],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.01085, 0.01085],
                                    type: 'translation',
                                },
                            ],
                            path: '5',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0224, 0.0224],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.02205, 0.02205],
                                    type: 'translation',
                                },
                            ],
                            path: '6',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0448, 0.0448],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.044449999999999996, 0.044449999999999996],
                                    type: 'translation',
                                },
                            ],
                            path: '7',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0896, 0.0896],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.08925, 0.08925],
                                    type: 'translation',
                                },
                            ],
                            path: '8',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.1792, 0.1792],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.17885, 0.17885],
                                    type: 'translation',
                                },
                            ],
                            path: '9',
                        },
                    ],
                },
            ],
        },
    },
    {
        '/0': {
            nodeType: 'array',
            path: '0',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 29998, 39998],
            attributes: {},
        },
        '/1': {
            nodeType: 'array',
            path: '1',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 14999, 19999],
            attributes: {},
        },
        '/2': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 7499, 9999],
            attributes: {},
        },
        '/3': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 3749, 4999],
            attributes: {},
        },
        '/4': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 1874, 2499],
            attributes: {},
        },
        '/5': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 937, 1249],
            attributes: {},
        },
        '/6': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 468, 624],
            attributes: {},
        },
        '/7': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 234, 312],
            attributes: {},
        },
        '/8': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 117, 156],
            attributes: {},
        },
        '/9': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 58, 78],
            attributes: {},
        },
    },
);
