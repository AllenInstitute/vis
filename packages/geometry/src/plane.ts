
export type CartesianAxis = 'x' | 'y' | 'z';

export type OrthogonalCartesianAxes = 'xy' | 'xz' | 'yz';

export type UVAxes = { u: CartesianAxis, v: CartesianAxis };

export type UVAxisMapping = {
    [prop in OrthogonalCartesianAxes]: UVAxes
};

export type OrthogonalAxisMapping = {
    [prop in OrthogonalCartesianAxes]: CartesianAxis
};

export class CartesianPlane {
    #plane: OrthogonalCartesianAxes;
    #uv: UVAxes;
    #ortho: CartesianAxis;

    static uvTable: UVAxisMapping = {
        xy: { u: 'x' as CartesianAxis, v: 'y' as CartesianAxis },
        xz: { u: 'x' as CartesianAxis, v: 'z' as CartesianAxis },
        yz: { u: 'y' as CartesianAxis, v: 'z' as CartesianAxis },
    };

    static orthogonalAxisTable: OrthogonalAxisMapping = {
        xy: 'z' as CartesianAxis,
        xz: 'y' as CartesianAxis,
        yz: 'x' as CartesianAxis,
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
        return {...this.#uv};
    }

    get ortho(): CartesianAxis {
        return this.#ortho;
    }

    isValid(): boolean {
        return this.#uv.u !== this.#uv.v;
    }
}
