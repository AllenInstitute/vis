// an axis aligned plane - not really useful for geometry - really more of a simplified way to pick a slice of an ome-zarr volume
type CartesianPlane = 'xy' | 'xz' | 'yz';

function u(plane: CartesianPlane) {
    switch (plane) {
        case 'xy':
            return 'x';
        case 'xz':
            return 'x';
        case 'yz':
            return 'y';
    }
}
function v(plane: CartesianPlane) {
    switch (plane) {
        case 'xy':
            return 'y';
        case 'xz':
            return 'z';
        case 'yz':
            return 'z';
    }
}
function orthogonal(plane: CartesianPlane) {
    switch (plane) {
        case 'xy':
            return 'z';
        case 'xz':
            return 'y';
        case 'yz':
            return 'x';
    }
}

export { type CartesianPlane, u, v, orthogonal };
