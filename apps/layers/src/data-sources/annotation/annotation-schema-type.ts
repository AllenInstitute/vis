export type PathCommandType = 'MoveTo' | 'LineTo' | 'CurveTo' | 'ClosePolygon';

export interface Color {
    red: number;
    green: number;
    blue: number;
}

export interface PathCommand {
    type: PathCommandType;
    data: number[];
}

export interface Path {
    ftvIndex?: number;
    color?: Color;
    commands?: PathCommand[];
}

export interface Annotation {
    closedPolygons?: Path[];
}

export interface AnnotationCodec {
    PathCommandType: PathCommandType;
    encodeColor(message: Color): Uint8Array;
    decodeColor(buffer: Uint8Array): Color;
    encodePathCommand(message: PathCommand): Uint8Array;
    decodePathCommand(buffer: Uint8Array): PathCommand;
    encodePath(message: Path): Uint8Array;
    decodePath(buffer: Uint8Array): Path;
    encodeAnnotation(message: Annotation): Uint8Array;
    decodeAnnotation(buffer: Uint8Array): Annotation;
}
