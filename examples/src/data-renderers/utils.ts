import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';

export function applyOptionalTrn(box: box2D, trn: undefined | { offset: vec2 }, inv = false) {
    // todo scale...
    return trn ? Box2D.translate(box, Vec2.scale(trn.offset, inv ? -1 : 1)) : box;
}
