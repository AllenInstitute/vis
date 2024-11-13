import { resolve, type CellPropertiesConnection, type Maybe } from "~/gqty";
import { nodeData } from "./nodes";
import { keys, trim } from "lodash";
import { filteredEdges } from "./filtered-edges";
import type { MetadataColumn } from "~/common/loaders/scatterplot/scatterbrain-loader";
import type { vec2, vec3 } from "@alleninstitute/vis-geometry";

export type TaxonomyFeatures = {
    datasetId: string;
    // this is obviously a demo, so for now the taxonomy layers are
    // named, and there are always 4.
    // TODO: an array (in order) of levels of the taxonomy
    // levels: ColumnRequest[];
    Class: MetadataColumn;
    SubClass: MetadataColumn;
    SuperType: MetadataColumn;
    Cluster: MetadataColumn;
}
export const exampleTaxonomy: TaxonomyFeatures = {
    Class: {
        type: 'METADATA',
        name: 'FS00DXV0T9R1X9FJ4QE'
    },
    SubClass: {
        type: 'METADATA',
        name: 'QY5S8KMO5HLJUF0P00K'
    },
    SuperType: {
        type: 'METADATA',
        name: '15BK47DCIOF1SLLUW9P'
    },
    Cluster: {
        type: 'METADATA',
        name: 'CBGC0U30VV9JPR60TJU'
    },
    datasetId: 'Q1NCWWPG6FZ0DNIXJBQ'
}

async function getTaxonomyLevelEntries(datasetId: string, version: string, cellTypeColumns: string[]) {
    const getNodes = (conn: Maybe<CellPropertiesConnection>) => ({
        nodes: conn?.nodes?.map(n => ({
            color: n.color,
            index: n.featureTypeValueIndex.index,
            title: n.featureType.title,
            value: n.featureTypeValueIndex.value
        }))
    })
    // figuring out where junk goes is weird... and I proxies dont help,
    // but now its looking pretty nice!
    const everything = await resolve(({ query: { cellProperties } }) => ({
        ...getNodes(cellProperties({
            first: 6000,
            where:
            {
                and: [
                    { dataset: { referenceId: { eq: datasetId }, version: { eq: version } } },
                    { featureType: { referenceId: { in: cellTypeColumns } } }
                ]
            }
        }))
    }));
    return everything.nodes;
}

export function mapBy<K extends string, T extends Record<K, string>>(items: readonly T[], k: K): Record<string, T & { idx: number }> {
    const dictionary: Record<string, T & { idx: number }> = {};
    items.forEach((item, index) => {
        dictionary[item[k]] = { ...item, idx: index };
    });
    return dictionary;
}

export function hexToRgb(hex: string): vec3 {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    if (result && result.length === 4) {
        return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    }
    return [0.0, 0.0, 0.0];
}

// a helper to combine the static data (nodes and edges)
// and data from the IDF (taxonomy basics)
export async function buildConstellationBuffers(taxonomy: TaxonomyFeatures) {
    const { datasetId, Class, SubClass, SuperType, Cluster } = taxonomy
    type N = { cx: number, cy: number, name: string, numCells: number, level: string; index: number; parent: string }
    type E = { start: N, end: N, pStart: N, pEnd: N, srcW: number, dstW: number }
    const A = getTaxonomyLevelEntries(datasetId, 'v0', [Class.name]).then((data) => mapBy(data ?? [], 'value'))
    const B = getTaxonomyLevelEntries(datasetId, 'v0', [SubClass.name]).then((data) => mapBy(data ?? [], 'value'))
    const C = getTaxonomyLevelEntries(datasetId, 'v0', [SuperType.name]).then((data) => mapBy(data ?? [], 'value'))
    const D = getTaxonomyLevelEntries(datasetId, 'v0', [Cluster.name]).then((data) => mapBy(data ?? [], 'value'))
    const [classes, subclasses, supertypes, clusters] = await Promise.all([A, B, C, D])
    // we have to stash all this in a nice, high-precision buffer:
    // RGBA (4) x 5 (each level + color) * longest column
    const longestCol = Math.max(...[classes, subclasses, supertypes, clusters].map((m) => keys(m).length))
    const texture = new Float32Array(8 * 4 * longestCol);
    const txFloatOffset = (col: number, row: number) => (row * 8 * 4) + col * 4;
    const lvls = {
        class: { map: classes, column: 0 },
        subclass: { map: subclasses, column: 1 },
        supertype: { map: supertypes, column: 2 },
        cluster: { map: clusters, column: 3 }
    }
    const nodeLines = nodeData.split('\n');
    // for each line, read in the bits...
    // level,level_name,label,name,parent,n_cells,centroid_x,centroid_y
    // here, name = 'value' from the idf cellPropertyConnection node thingy
    // levelName is class, subclass, etc...
    const nodesByLabel: Record<string, N> = {}
    const edgesByLevel: Record<string, E[]> = {}
    for (const line of nodeLines) {
        const [level, levelName, label, name, parent, numCells, cx, cy] = line.split(',');
        const CX = Number.parseFloat(cx);
        const CY = Number.parseFloat(cy);
        const R = Number.parseFloat(numCells);
        const lvlName = levelName.toLowerCase()
        nodesByLabel[label] = { cx: CX, cy: CY, numCells: R, name, level: lvlName, index: lvls[lvlName as keyof typeof lvls].map[name].index, parent }
        const L = lvls[levelName.toLowerCase() as keyof typeof lvls];
        if (L) {
            const info = L.map[name];
            if (info) {
                const clrOffset = txFloatOffset(L.column + 4, info.index);
                const rgb = hexToRgb(info.color ?? '0xFF0000');
                texture[clrOffset] = rgb[0] / 255;
                texture[clrOffset + 1] = rgb[1] / 255;
                texture[clrOffset + 2] = rgb[2] / 255;

                const offset = txFloatOffset(L.column, info.index);
                texture[offset] = CX;
                texture[offset + 1] = CY;
                texture[offset + 2] = 5 - L.column;
                texture[offset + 3] = R;
            } else {
                console.error('no such taxon (csv mistake?)', name)
            }
        } else {
            // complain!
            console.error('no such level (csv mistake?)', levelName)
        }
    }
    const getClassId = (n: N): number => {
        const p = nodesByLabel[n.parent];
        if (!p) {
            return n.index;
        }
        return getClassId(p);
    }
    const edgeLines = filteredEdges.split('\n');
    for (const line of edgeLines) {
        const [s, e, srcW, dstW] = line.split(',').map(trim);
        const Start = nodesByLabel[s]
        const End = nodesByLabel[e];
        // figure out parentStart and parent end...
        if (Start && End) {
            const parents = { start: nodesByLabel[Start.parent], end: nodesByLabel[End.parent] }

            const { level } = Start;
            if (!edgesByLevel[level]) {
                edgesByLevel[level] = []
            }
            const lvl = edgesByLevel[level];
            lvl.push({ srcW: Number.parseFloat(srcW), dstW: Number.parseFloat(dstW), start: Start, pStart: parents.start ?? Start, end: End, pEnd: parents.end ?? End })
        }
    }
    const buildEdgeBuffersForLevel = (edges: undefined | E[]) => {
        if (edges === undefined || edges.length === 0) {
            return null;
        }
        const keepers = edges.length;

        const B = 3;
        const P = 2;
        const S = new Float32Array(keepers * B);
        const E = new Float32Array(keepers * B);
        const pS = new Float32Array(keepers * P);
        const pE = new Float32Array(keepers * P);

        for (let i = 0; i < edges.length; i++) {
            const { start, end, pStart, pEnd, srcW, dstW } = edges[i];

            S[(i * B) + 0] = start.index;
            S[(i * B) + 1] = getClassId(start)
            S[(i * B) + 2] = srcW * Math.sqrt(start.numCells) / 400;

            E[(i * B) + 0] = end.index;
            E[(i * B) + 1] = getClassId(end);
            E[(i * B) + 2] = dstW * Math.sqrt(end.numCells) / 400;

            pS[(i * P) + 0] = pStart.index;
            pS[(i * P) + 1] = getClassId(pStart);

            pE[(i * P) + 0] = pEnd.index;
            pE[(i * P) + 1] = getClassId(pEnd);
        }
        return { start: S, end: E, pStart: pS, pEnd: pE, count: keepers }
    }
    return { edgesByLevel: [edgesByLevel['class'], edgesByLevel['subclass'], edgesByLevel['supertype'], edgesByLevel['cluster']].map(buildEdgeBuffersForLevel), texture, size: [8, longestCol] as vec2 }
}
