// generic rendering of renderable things...

import type { Interval, box2D, vec2, vec4 } from '@alleninstitute/vis-geometry';
import type { NormalStatus } from '@alleninstitute/vis-core';

// a basic camera, for viewing slices
export type Camera = {
    readonly view: box2D; // a view in 'data space'
    readonly screen: vec2; // what that view projects to in display space, aka pixels
    readonly projection: 'webImage' | 'cartesian';
};

type ChannelSettings = {
    gamut: Interval;
    index: number;
};
export type ColorMapping = {
    R: ChannelSettings;
    G: ChannelSettings;
    B: ChannelSettings;
};

type Path = {
    points: vec2[];
    bounds: box2D;
    color: vec4;
};
type Drawing = {
    paths: readonly Path[];
    // todo more later...
};
export type AnnotationLayer = {
    type: 'AnnotationLayer';
    dimensions: 2;
    drawing: Drawing;
};
export type TwoDimensional = {
    dimensions: 2;
};
export type RenderCallback = (event: { status: NormalStatus } | { status: 'error'; error: unknown }) => void;
