import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';

/**
 * Converts a canvas pixel position to data space.
 * @param view the region of data space in frame
 * @param screenSize size of the canvas region, in pixels
 * @param screenPos position relative to the top left of that region
 */
export const screenToData = (view: box2D, screenSize: vec2, screenPos: vec2): vec2 => {
    return Vec2.add(view.minCorner, Vec2.mul(Vec2.div(screenPos, screenSize), Box2D.size(view)));
}

/**
 * Scales a view about a fixed point, which comes out where it went in.
 * @param view the region of data space in frame
 * @param dataPoint the point to hold still, in data space
 * @param zoomScale below 1 zooms in, above 1 zooms out
 */
export const zoomAround = (view: box2D, dataPoint: vec2, zoomScale: number): box2D => {
    return Box2D.translate(
        Box2D.scale(Box2D.translate(view, Vec2.scale(dataPoint, -1)), [zoomScale, zoomScale]),
        dataPoint
    );
}

/**
 * Zooms about the cursor, keeping whatever is under it in place.
 * @param view the region of data space in frame
 * @param screenSize size of the canvas region, in pixels
 * @param zoomScale below 1 zooms in, above 1 zooms out
 * @param mousePos cursor position relative to the top left of that region
 */
export const zoom = (view: box2D, screenSize: vec2, zoomScale: number, mousePos: vec2): box2D => {
    return zoomAround(view, screenToData(view, screenSize, mousePos), zoomScale);
}

/**
 * Pans by a pixel delta, so the data under the cursor follows a drag.
 * @param view the region of data space in frame
 * @param screenSize size of the canvas region, in pixels
 * @param delta how far the cursor moved, in pixels
 */
export const pan = (view: box2D, screenSize: vec2, delta: vec2): box2D => {
    const relative = Vec2.div(Vec2.mul(delta, [-1, -1]), screenSize);
    const offset = Vec2.mul(relative, Box2D.size(view));
    return Box2D.translate(view, offset);
}

/**
 * Frames the whole image, letterboxing whichever axis has room to spare.
 * @param imageSize size of the image, in data units
 * @param screenSize size of the canvas region, in pixels
 * @returns a view at the origin with the same aspect ratio as the screen
 */
export const fitToScreen = (imageSize: vec2, screenSize: vec2): box2D => {
    const unitsPerPx = Math.max(imageSize[0] / screenSize[0], imageSize[1] / screenSize[1]);
    return Box2D.create([0, 0], Vec2.scale(screenSize, unitsPerPx));
}
