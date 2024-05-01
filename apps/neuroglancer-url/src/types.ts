export type NeuroglancerConfig = {
    red_min: number;
    red_max: number;
    green_min: number;
    green_max: number;
    blue_min: number;
    blue_max: number;
    img_name: string;
    x_mm: number;
    y_mm: number;
    z_mm: number;
    src_url: string;
    cross_section_scale?: number;
    layout?: string;
    ome_zarr_shape?: number[];
};
export type ImageSeriesConfig = NeuroglancerConfig & {
    ome_zarr_shape: number[];
    src_url: string;
};
export type ContactSheetConfig = NeuroglancerConfig & {
    ome_zarr_shape: number[];
};
export type NGFunc = 'get_contact_sheet_url' | 'get_neuroglancer_url' | 'get_image_series_grid_url';

export type NGData = {
    function: NGFunc;
    params:
        | {
              src_config_list: NeuroglancerConfig[];
          }
        | NeuroglancerConfig;
    type: string;
    url: string;
};

export type ImageSeriesData = {
    function: NGFunc;
    params: {
        src_config_list: NeuroglancerConfig[];
    };
    type: string;
    url: string;
};

export type RegularData = {
    function: NGFunc;
    params: NeuroglancerConfig;
    type: string;
    url: string;
};
