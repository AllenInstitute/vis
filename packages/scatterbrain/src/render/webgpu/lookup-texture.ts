import type { vec4 } from "@alleninstitute/vis-geometry";
import { reduce, keys } from "lodash";

/**
 * a helper function that MUTATES ALL the values in the given @param texture
 * to set them to the color and filter status as given in the categories record
 * note that the texture's maping to categories is based on a lexical sorting of the names of the
 * categories
 * @param categories
 * @param regl
 * @param texture
 */
export function setCategoricalLookupTableValues(

    categories: Record<string, Record<number, { color: vec4; filteredIn: boolean }>>,
    device: GPUDevice,
    texture: GPUTexture,
) {
    const bytesPerPixel = 4; // rgba8
    const categoryKeys = keys(categories).toSorted();
    const columns = categoryKeys.length;
    const rows = reduce(categoryKeys, (highest, category) => Math.max(highest, keys(categories[category]).length), 1);
    const data = new Uint8Array(columns * rows * 4);
    const rgbf = [0, 0, 0, 0];
    const empty = [0, 0, 0, 0] as const;
    // write the rgb of the color, and encode the filter boolean into the alpha channel
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
        const category = categories[categoryKeys[columnIndex]];
        const nRows = keys(category).length;
        for (let rowIndex = 0; rowIndex < nRows; rowIndex += 1) {
            const color = category[rowIndex]?.color ?? empty;
            const filtered = category[rowIndex]?.filteredIn ?? false;
            rgbf[0] = color[0] * 255;
            rgbf[1] = color[1] * 255;
            rgbf[2] = color[2] * 255;
            rgbf[3] = filtered ? 255 : 0;
            data.set(rgbf, rowIndex * columns * 4 + columnIndex * 4);
        }
    }
    device.queue.writeTexture({ texture }, data, { bytesPerRow: rows, rowsPerImage: columns * bytesPerPixel }, {
        width: columns,
        height: rows,
    });
}

/**
 * same as setCategoricalLookupTableValues, except it only writes a single value update to the texture.
 * note that the list of categories given must match those used to construct the texture, and are needed here
 * due to the lexical sorting order determining the column order of the @param texture
 * @param categories
 * @param update
 * @param regl
 * @param texture
 */
export function updateCategoricalValue(
    categories: readonly string[],
    update: { category: string; row: number; color: vec4; filteredIn: boolean },
    device: GPUDevice,
    texture: GPUTexture,
) {
    const { category, row, color, filteredIn } = update;
    const col = categories.toSorted().indexOf(category);
    if (texture.width <= col || texture.height <= row || row < 0 || col < 0) {
        // todo - it might be better to let regl throw the same error... think about it
        throw new Error(
            `attempted to update metadata lookup table with invalid coordinates: row=${row},col=${col} is not within ${texture.width}, ${texture.height}`,
        );
    }
    const data = new Uint8Array(4);
    data[0] = color[0] * 255;
    data[1] = color[1] * 255;
    data[2] = color[2] * 255;
    data[3] = filteredIn ? 255 : 0;
    device.queue.writeTexture(
        { texture, origin: { x: col, y: row } }, data, { bytesPerRow: 4, rowsPerImage: 1 }, {
        width: 1,
        height: 1,
    });
}