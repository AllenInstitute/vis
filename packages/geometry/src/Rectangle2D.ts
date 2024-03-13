import type { box2D } from "./box2D";
import { Vec2, type vec2 } from "./vec2";

export type rectangle2D = {
  center: vec2;
  size: vec2;
};

export function getMinimumBoundingBox(rect: rectangle2D): box2D {
  const { center, size } = rect;
  const half = Vec2.scale(size, 0.5);
  return {
    minCorner: Vec2.sub(center, half),
    maxCorner: Vec2.add(center, half),
  };
}
// return a rectangle scaled by scale, with the origin of the scaling at the given point
export const scaleFromPoint = (rect: rectangle2D, scale: number, point: vec2) => {
  const centerFromOrigin = Vec2.sub(rect.center, point);
  const newCenter = Vec2.add(Vec2.scale(centerFromOrigin, scale), point);
  return {
    ...rect,
    center: newCenter,
    size: Vec2.scale(rect.size, scale),
  };
};

// linearly interpolate start --> end
export function interpolateRectangles<T extends rectangle2D>(start: T, end: T, parameter: number): T {
    return {
        ...start,
        center: Vec2.mix(start.center, end.center, parameter),
        size: Vec2.mix(start.size, end.size, parameter),
    };
}
