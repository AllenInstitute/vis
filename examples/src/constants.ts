export const colors = {
    dark: {
        background: "rgb(18, 18, 18)",
        text: "rgb(255, 255, 255)",
        textSelected: "rgb(93, 167, 229)",
    },
    light: {
        text: "rgb(0, 0, 0)",
        textSelected: "rgb(93, 167, 229)",
    },
    border: "rgb(64, 64, 64)",
};

export const spacing = {
    xxs: 1,
    xs: 2,
    s: 4,
    m: 8,
    l: 16,
    xl: 32,
};

type page = {
    name: string;
    url: string;
    external?: boolean;
};

export const pages: Array<page> = [
    { name: "DZI", url: "dzi" },
    { name: "OMEZARR", url: "omezarr" },
    { name: "Layers", url: "layers", external: true },
];
