import type { ZarrDataset } from '../zarr-data';
import { describe, expect, it } from 'vitest';
import { Box2D, box2D } from '@alleninstitute/vis-geometry';
import { getVisibleTiles } from './loader'
const exampleOmeZarr: ZarrDataset = {
    "url": "https://allen-genetic-tools.s3.us-west-2.amazonaws.com/tissuecyte/1263343692/ome-zarr/",
    "multiscales": [
        {
            "axes": [
                {
                    "name": "c",
                    "type": "channel",
                    unit: 'millimeter'
                },
                {
                    "name": "z",
                    "type": "space",
                    "unit": "millimeter"
                },
                {
                    "name": "y",
                    "type": "space",
                    "unit": "millimeter"
                },
                {
                    "name": "x",
                    "type": "space",
                    "unit": "millimeter"
                }
            ],
            "datasets": [
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.00035,
                                0.00035
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0,
                                0
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "0",
                    "shape": [
                        3,
                        142,
                        29998,
                        39998
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0007,
                                0.0007
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.00035,
                                0.00035
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "1",
                    "shape": [
                        3,
                        142,
                        14999,
                        19999
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0014,
                                0.0014
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.00105,
                                0.00105
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "2",
                    "shape": [
                        3,
                        142,
                        7499,
                        9999
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0028,
                                0.0028
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.00245,
                                0.00245
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "3",
                    "shape": [
                        3,
                        142,
                        3749,
                        4999
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0056,
                                0.0056
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.00525,
                                0.00525
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "4",
                    "shape": [
                        3,
                        142,
                        1874,
                        2499
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0112,
                                0.0112
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.01085,
                                0.01085
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "5",
                    "shape": [
                        3,
                        142,
                        937,
                        1249
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0224,
                                0.0224
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.02205,
                                0.02205
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "6",
                    "shape": [
                        3,
                        142,
                        468,
                        624
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0448,
                                0.0448
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.044449999999999996,
                                0.044449999999999996
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "7",
                    "shape": [
                        3,
                        142,
                        234,
                        312
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.0896,
                                0.0896
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.08925,
                                0.08925
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "8",
                    "shape": [
                        3,
                        142,
                        117,
                        156
                    ]
                },
                {
                    "coordinateTransformations": [
                        {
                            "scale": [
                                1,
                                0.1,
                                0.1792,
                                0.1792
                            ],
                            "type": "scale"
                        },
                        {
                            "translation": [
                                0,
                                0,
                                0.17885,
                                0.17885
                            ],
                            "type": "translation"
                        }
                    ],
                    "path": "9",
                    "shape": [
                        3,
                        142,
                        58,
                        78
                    ]
                }
            ],
        }
    ]
}

describe('omezarr basic tiled loading', () => {
    describe('getVisibleTiles', () => {
        it('visible tiles cannot extend beyond the bounds of their layer', () => {
            const view: box2D = {
                minCorner: [
                    -7,
                    -11
                ],
                maxCorner: [
                    28,
                    35
                ]
            }
            const camera = { view, screenSize: [210, 210] as const }
            const visible = getVisibleTiles(camera, 'xy', 2, exampleOmeZarr, 256);
            // this is a basic regression test: we had a bug which would result in 
            // tiles from the image being larger than the image itself (they would be the given tile size)
            expect(visible.length).toBe(1)
            const expectedLayer = exampleOmeZarr.multiscales[0].datasets[9];
            // we expect to be seeing the lowest resolution layer with our very zoomed out, low res camera
            const [_c, _z, y, x] = expectedLayer.shape;
            expect(visible[0].bounds).toEqual(Box2D.create([0, 0], [x, y]))
        })
    })
})