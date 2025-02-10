import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';

// a basic camera, for viewing slices
export type Camera = {
	readonly view: box2D; // a view in 'data space'
	readonly screen: vec2; // what that view projects to in display space, aka pixels
	readonly projection: 'webImage' | 'cartesian';
};
/**
 * Zooms relative to your current mouse position
 * @param view box2d in dataspace that is mapped to the canvas
 * @param screenSize in pixels
 * @param zoomScale
 * @param mousePos mouse position in pixels
 */
export function zoom(view: box2D, screenSize: vec2, zoomScale: number, mousePos: vec2): box2D {
	// translate mouse pos to data space
	// offset divided by screen size gives us a percentage of the canvas where the mouse is
	// multiply percentage by view size to make it data space
	// add offset of the min corner so that the position takes into account any box offset
	const zoomPoint: vec2 = Vec2.add(view.minCorner, Vec2.mul(Vec2.div(mousePos, screenSize), Box2D.size(view)));

	// scale the box with our new zoom point as the center
	const newView = Box2D.translate(
		Box2D.scale(Box2D.translate(view, Vec2.scale(zoomPoint, -1)), [zoomScale, zoomScale]),
		zoomPoint,
	);

	return newView;
}

/**
 *
 * @param view box2d in dataspace that is mapped to the canvas
 * @param screenSize
 * @param mousePos mouse position in pixels
 */
export function pan(view: box2D, screenSize: vec2, mousePos: vec2): box2D {
	const relativePos = Vec2.div(Vec2.mul(mousePos, [-1, -1]), screenSize);
	const scaledOffset = Vec2.mul(relativePos, Box2D.size(view));
	const newView = Box2D.translate(view, scaledOffset);
	return newView;
}
