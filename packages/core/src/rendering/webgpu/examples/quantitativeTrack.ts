import { shader, $s, $a, f32, vec3f } from '../shaders';

const Gradient = $s.struct('Gradient', [
    $s.member('low', vec3f),
    $s.member('mid', vec3f),
    $s.member('top', vec3f),
    $s.member('domain', vec3f)
]);

const Aesthetic = $s.struct('Aesthetic', [
    $s.member('gradient', Gradient),
    $s.member('y', f32),
]);

const sh = shader([

]);