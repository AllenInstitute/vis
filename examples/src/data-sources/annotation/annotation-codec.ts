import type { AnnotationCodec } from './annotation-schema-type';
import { parseSchema, compileSchema } from 'kiwi-schema';

export const AnnotationSchema = `
enum PathCommandType {
    MoveTo = 0;
    LineTo = 1;
    CurveTo= 2;
    ClosePolygon=3;
}

struct Color {
  byte red;
  byte green;
  byte blue;
}

struct PathCommand {
    PathCommandType type;
    float[] data;
}

message Path {
    int ftvIndex=1;
    string hoverText=2;
    Color color=3;
    PathCommand[] commands=4;
}

message Annotation {
    Path[] closedPolygons=1;
}`;

let codec: AnnotationCodec | undefined;
export function getAnnotationCodec() {
	if (!codec) {
		try {
			codec = compileSchema(parseSchema(AnnotationSchema));
		} catch (err) {
			return undefined;
		}
	}
	return codec;
}
