import { describe, it, expect } from 'vitest';
import {
    alias,
    computeEntry,
    constant,
    fragmentEntry,
    func,
    member,
    override,
    param,
    privateVar,
    returns,
    sampler,
    storage,
    struct,
    texture,
    uniform,
    vertexEntry,
    workgroupVar,
} from './declarations';
import { align, builtin, id, location, mustUse, size } from './attributes';

describe('constant', () => {
    it('generates const without a type annotation', () => {
        expect(constant('pi', 3.14159).__gen()).toBe('const pi = 3.14159;');
    });

    it('generates const with an explicit type annotation', () => {
        expect(constant('pi', 3.14159, 'f32').__gen()).toBe('const pi: f32 = 3.14159;');
    });

    it('generates const with a string initializer', () => {
        const init = 'array<vec2f,4>(vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(-1,1))';
        expect(constant('clip', init).__gen()).toBe(`const clip = ${init};`);
    });
});

describe('override', () => {
    it('generates override with type only', () => {
        expect(override('scale', 'f32').__gen()).toBe('var<override> scale: f32;');
    });

    it('generates override with initializer only', () => {
        expect(override('count', undefined, 10).__gen()).toBe('var<override> count = 10;');
    });

    it('generates override with type and initializer', () => {
        expect(override('limit', 'u32', 256).__gen()).toBe('var<override> limit: u32 = 256;');
    });

    it('generates override with an id attribute', () => {
        expect(override('idx', 'u32', undefined, [id(5)]).__gen()).toBe('@id(5) var<override> idx: u32;');
    });

    it('throws when both type and initializer are omitted', () => {
        expect(() => override('x')).toThrow();
    });
});

describe('privateVar', () => {
    it('generates var<private> with type only', () => {
        expect(privateVar('x', 'f32').__gen()).toBe('var<private> x: f32;');
    });

    it('generates var<private> with type and initializer', () => {
        expect(privateVar('count', 'u32', 0).__gen()).toBe('var<private> count: u32 = 0;');
    });

    it('generates var<private> with no type or initializer', () => {
        expect(privateVar('x').__gen()).toBe('var<private> x;');
    });
});

describe('workgroupVar', () => {
    it('generates var<workgroup> with a type', () => {
        expect(workgroupVar('shared', 'array<f32, 64>').__gen()).toBe('var<workgroup> shared: array<f32, 64>;');
    });
});

describe('uniform', () => {
    it('generates a uniform variable declaration', () => {
        expect(uniform('unis', 'Uniforms', 0, 0).__gen()).toBe('@group(0) @binding(0) var<uniform> unis: Uniforms;');
    });

    it('generates with non-zero group and binding indices', () => {
        expect(uniform('data', 'DataBlock', 2, 5).__gen()).toBe('@group(2) @binding(5) var<uniform> data: DataBlock;');
    });
});

describe('texture', () => {
    it('generates texture_2d<f32>', () => {
        expect(texture('colorMap', 'texture_2d<f32>', 0, 1).__gen()).toBe(
            '@group(0) @binding(1) var colorMap: texture_2d<f32>;'
        );
    });

    it('generates texture_depth_2d', () => {
        expect(texture('depthMap', 'texture_depth_2d', 0, 2).__gen()).toBe(
            '@group(0) @binding(2) var depthMap: texture_depth_2d;'
        );
    });

    it('generates texture_storage_2d with format and access', () => {
        expect(texture('outputTex', 'texture_storage_2d<rgba8unorm, write>', 0, 3).__gen()).toBe(
            '@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;'
        );
    });
});

describe('sampler', () => {
    it('generates a sampler declaration', () => {
        expect(sampler('s', 'sampler', 0, 3).__gen()).toBe('@group(0) @binding(3) var s: sampler;');
    });

    it('generates a sampler_comparison declaration', () => {
        expect(sampler('sc', 'sampler_comparison', 0, 4).__gen()).toBe(
            '@group(0) @binding(4) var sc: sampler_comparison;'
        );
    });
});

describe('storage', () => {
    it('generates storage without an access mode', () => {
        expect(storage('buf', 'array<f32>', 0, 5).__gen()).toBe('@group(0) @binding(5) var<storage> buf: array<f32>;');
    });

    it('generates storage with read access mode', () => {
        expect(storage('buf', 'array<f32>', 0, 5, 'read').__gen()).toBe(
            '@group(0) @binding(5) var<storage, read> buf: array<f32>;'
        );
    });

    it('generates storage with read_write access mode', () => {
        expect(storage('buf', 'array<f32>', 0, 5, 'read_write').__gen()).toBe(
            '@group(0) @binding(5) var<storage, read_write> buf: array<f32>;'
        );
    });
});

describe('member', () => {
    it('generates a plain struct member', () => {
        expect(member('x', 'f32').__gen()).toBe('x: f32');
    });

    it('generates a member with a builtin attribute', () => {
        expect(member('pos', 'vec4f', [builtin('position')]).__gen()).toBe('@builtin(position) pos: vec4f');
    });

    it('generates a member with a location attribute', () => {
        expect(member('color', 'vec4f', [location(0)]).__gen()).toBe('@location(0) color: vec4f');
    });

    it('generates a member with align and size attributes', () => {
        expect(member('data', 'vec4f', [align(16), size(16)]).__gen()).toBe('@align(16) @size(16) data: vec4f');
    });
});

describe('struct', () => {
    it('generates a struct with a single field', () => {
        expect(struct('Point', [member('x', 'f32')]).__gen()).toBe('struct Point { x: f32 }');
    });

    it('generates a struct with multiple fields', () => {
        expect(struct('Vec2', [member('x', 'f32'), member('y', 'f32')]).__gen()).toBe('struct Vec2 { x: f32, y: f32 }');
    });

    it('generates a struct with attributed members', () => {
        const s = struct('VsOutput', [
            member('pos', 'vec4f', [builtin('position')]),
            member('color', 'vec4f', [location(0)]),
        ]);
        expect(s.__gen()).toBe('struct VsOutput { @builtin(position) pos: vec4f, @location(0) color: vec4f }');
    });

    it('has __identType of "struct"', () => {
        expect(struct('Test', [member('x', 'f32')]).__identType).toBe('struct');
    });
});

describe('alias', () => {
    it('generates alias with a string type', () => {
        expect(alias('Vec2', 'vec2f').__gen()).toBe('alias Vec2 = vec2f;');
    });

    it('generates alias referencing a struct by name', () => {
        const s = struct('Point', [member('x', 'f32')]);
        expect(alias('PointAlias', s).__gen()).toBe('alias PointAlias = Point;');
    });

    it('generates alias referencing another alias by name', () => {
        const inner = alias('Base', 'vec2f');
        expect(alias('Derived', inner).__gen()).toBe('alias Derived = Base;');
    });

    it('has __identType of "alias"', () => {
        expect(alias('A', 'f32').__identType).toBe('alias');
    });
});

describe('param', () => {
    it('generates a plain parameter', () => {
        expect(param('x', 'f32').__gen()).toBe('x: f32');
    });

    it('generates a parameter with a builtin attribute', () => {
        expect(param('idx', 'u32', [builtin('vertex_index')]).__gen()).toBe('@builtin(vertex_index) idx: u32');
    });
});

describe('returns', () => {
    it('generates a plain return type', () => {
        expect(returns('f32').__gen()).toBe('f32');
    });

    it('generates a plain return type from a Struct', () => {
        const s = struct('Point', [member('x', 'f32')]);
        expect(returns(s).__gen()).toBe('Point');
    });

    it('generates a plain return type from an aliased Struct', () => {
        const s = struct('Point', [member('x', 'f32')]);
        const a = alias('PointAlias', s);
        expect(returns(a).__gen()).toBe('PointAlias');
    });

    it('generates a return type with a location attribute', () => {
        expect(returns('vec4f', [location(0)]).__gen()).toBe('@location(0) vec4f');
    });
});

describe('func', () => {
    it('generates a void function (no return type)', () => {
        const f = func('doWork', [param('x', 'f32')], () => 'let x = x + 1.0;');
        expect(f.__gen()).toBe('fn doWork(x: f32) { let x = x + 1.0; }');
    });

    it('generates a function with a return type', () => {
        const f = func('double', [param('x', 'f32')], () => 'return x * 2.0;', returns('f32'));
        expect(f.__gen()).toBe('fn double(x: f32) -> f32 { return x * 2.0; }');
    });

    it('generates a function with no parameters', () => {
        const f = func('noop', [], () => '');
        expect(f.__gen()).toBe('fn noop() {  }');
    });

    it('generates a function with multiple parameters', () => {
        const f = func('add', [param('a', 'f32'), param('b', 'f32')], () => 'return a + b;', returns('f32'));
        expect(f.__gen()).toBe('fn add(a: f32, b: f32) -> f32 { return a + b; }');
    });

    it('generates a function with function-level attributes', () => {
        const f = func('getValue', [], () => 'return 1.0;', returns('f32'), [mustUse()]);
        expect(f.__gen()).toBe('@must_use fn getValue() -> f32 { return 1.0; }');
    });

    it('re-evaluates the body function on each __gen() call', () => {
        let callCount = 0;
        const f = func('counter', [], () => {
            callCount++;
            return '';
        });
        f.__gen();
        f.__gen();
        expect(callCount).toBe(2);
    });
});

describe('vertexEntry', () => {
    it('generates a @vertex-annotated function', () => {
        const f = vertexEntry('vmain', [param('v', 'Vertex')], () => 'return v;', returns('VsOutput'));
        expect(f.__gen()).toBe('@vertex fn vmain(v: Vertex) -> VsOutput { return v; }');
    });

    it('has @vertex as its sole function attribute', () => {
        const f = vertexEntry('vmain', [], () => '');
        expect(f.attributes).toHaveLength(1);
        expect(f.attributes?.[0]?.__gen()).toBe('@vertex');
    });
});

describe('fragmentEntry', () => {
    it('generates a @fragment-annotated function', () => {
        const f = fragmentEntry(
            'fmain',
            [param('v', 'VsOutput')],
            () => 'return v.color;',
            returns('vec4f', [location(0)])
        );
        expect(f.__gen()).toBe('@fragment fn fmain(v: VsOutput) -> @location(0) vec4f { return v.color; }');
    });

    it('has @fragment as its sole function attribute', () => {
        const f = fragmentEntry('fmain', [], () => '');
        expect(f.attributes).toHaveLength(1);
        expect(f.attributes?.[0]?.__gen()).toBe('@fragment');
    });
});

describe('computeEntry', () => {
    it('generates a @compute-annotated function', () => {
        const f = computeEntry('cmain', [param('gid', 'vec3u', [builtin('global_invocation_id')])], () => '');
        expect(f.__gen()).toBe('@compute fn cmain(@builtin(global_invocation_id) gid: vec3u) {  }');
    });

    it('has @compute as its sole function attribute', () => {
        const f = computeEntry('cmain', [], () => '');
        expect(f.attributes).toHaveLength(1);
        expect(f.attributes?.[0]?.__gen()).toBe('@compute');
    });
});
