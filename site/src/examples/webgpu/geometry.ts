/**
 * Vertex geometry for the three demo solids — cube, tetrahedron, dodecahedron.
 *
 * Each mesh is indexed (shared vertices) and normalized to unit circumradius so the shapes read
 * at a comparable size. Only positions are stored: the fragment shader reconstructs a per-face
 * normal from screen-space derivatives (`dpdx`/`dpdy`), so no normal attribute is needed. Winding
 * is irrelevant because the pipeline uses a depth buffer with `cullMode: 'none'`.
 */

export interface Mesh {
    /** Flat xyz positions, unit circumradius. */
    readonly positions: Float32Array;
    /** Triangle-list indices (uint16). */
    readonly indices: Uint16Array;
}

/** Normalize vertices to unit circumradius and fan-triangulate each (convex) face. */
function build(vertices: readonly (readonly [number, number, number])[], faces: readonly number[][]): Mesh {
    const maxLen = Math.max(...vertices.map(([x, y, z]) => Math.hypot(x, y, z)));
    const positions = new Float32Array(vertices.length * 3);
    vertices.forEach(([x, y, z], i) => {
        positions[i * 3] = x / maxLen;
        positions[i * 3 + 1] = y / maxLen;
        positions[i * 3 + 2] = z / maxLen;
    });
    const indices: number[] = [];
    for (const face of faces) {
        for (let i = 1; i < face.length - 1; i++) {
            indices.push(face[0] as number, face[i] as number, face[i + 1] as number);
        }
    }
    return { positions, indices: new Uint16Array(indices) };
}

// ---- Cube --------------------------------------------------------------------------------------

export const cube: Mesh = build(
    [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1],
    ],
    [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 4, 7, 3],
        [1, 5, 6, 2],
        [0, 1, 5, 4],
        [3, 2, 6, 7],
    ]
);

// ---- Tetrahedron -------------------------------------------------------------------------------

export const tetrahedron: Mesh = build(
    [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
    ],
    [
        [0, 1, 2],
        [0, 2, 3],
        [0, 3, 1],
        [1, 3, 2],
    ]
);

// ---- Dodecahedron ------------------------------------------------------------------------------
// Regular dodecahedron: 20 vertices built from the golden ratio, 12 pentagonal faces.

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

export const dodecahedron: Mesh = build(
    [
        // (±1, ±1, ±1) — the inscribed cube
        [1, 1, 1],
        [1, 1, -1],
        [1, -1, 1],
        [1, -1, -1],
        [-1, 1, 1],
        [-1, 1, -1],
        [-1, -1, 1],
        [-1, -1, -1],
        // (0, ±1/φ, ±φ)
        [0, INV_PHI, PHI],
        [0, INV_PHI, -PHI],
        [0, -INV_PHI, PHI],
        [0, -INV_PHI, -PHI],
        // (±1/φ, ±φ, 0)
        [INV_PHI, PHI, 0],
        [INV_PHI, -PHI, 0],
        [-INV_PHI, PHI, 0],
        [-INV_PHI, -PHI, 0],
        // (±φ, 0, ±1/φ)
        [PHI, 0, INV_PHI],
        [PHI, 0, -INV_PHI],
        [-PHI, 0, INV_PHI],
        [-PHI, 0, -INV_PHI],
    ],
    [
        [0, 8, 10, 2, 16],
        [0, 16, 17, 1, 12],
        [0, 12, 14, 4, 8],
        [1, 17, 3, 11, 9],
        [1, 9, 5, 14, 12],
        [2, 10, 6, 15, 13],
        [2, 13, 3, 17, 16],
        [3, 13, 15, 7, 11],
        [4, 14, 5, 19, 18],
        [4, 18, 6, 10, 8],
        [5, 9, 11, 7, 19],
        [6, 18, 19, 7, 15],
    ]
);
