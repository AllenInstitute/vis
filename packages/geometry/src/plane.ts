export type CartesianAxis = 'x' | 'y' | 'z';

export type OrthogonalCartesianAxes = 'xy' | 'xz' | 'yz';

export type UVAxes = { u: CartesianAxis; v: CartesianAxis };

export type UVAxisMapping = {
    [prop in OrthogonalCartesianAxes]: UVAxes;
};

export type OrthogonalAxisMapping = {
    [prop in OrthogonalCartesianAxes]: CartesianAxis;
};

export class CartesianPlane {
    #plane: OrthogonalCartesianAxes;
    #uv: UVAxes;
    #ortho: CartesianAxis;

    static uvTable: UVAxisMapping = {
        xy: { u: 'x', v: 'y' },
        xz: { u: 'x', v: 'z' },
        yz: { u: 'y', v: 'z' },
    };

    static orthogonalAxisTable: OrthogonalAxisMapping = {
        xy: 'z',
        xz: 'y',
        yz: 'x',
    };

    constructor(plane: OrthogonalCartesianAxes) {
        this.#plane = plane;
        this.#uv = CartesianPlane.uvTable[this.#plane];
        this.#ortho = CartesianPlane.orthogonalAxisTable[this.#plane];
    }

    get axes(): OrthogonalCartesianAxes {
        return this.#plane;
    }

    get u(): CartesianAxis {
        return this.#uv.u;
    }

    get v(): CartesianAxis {
        return this.#uv.v;
    }

    get uv(): UVAxes {
        return { ...this.#uv };
    }

    get ortho(): CartesianAxis {
        return this.#ortho;
    }

    isValid(): boolean {
        return this.#uv.u !== this.#uv.v;
    }
}

export const PLANE_XY = new CartesianPlane('xy');
export const PLANE_XZ = new CartesianPlane('xz');
export const PLANE_YZ = new CartesianPlane('yz');
