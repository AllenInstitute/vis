import { getContactSheetUrl } from './contact-sheet';
import { getImageSeriesGridUrl } from './image-series';
import type { ImageSeriesData, RegularData } from './types';
import { getNeuroglancerUrl } from './utils';

export function makeImageSeriesElems(imageSeries: ImageSeriesData[], parent: HTMLElement) {
    imageSeries.forEach((item, idx) => {
        const configs = item.params.src_config_list;
        const elem = document.createElement('p');
        const url = getImageSeriesGridUrl(configs);
        elem.innerText = url;
        elem.style.maxWidth = '500px';
        elem.style.textWrap = 'nowrap';
        elem.style.overflow = 'hidden';
        elem.style.textOverflow = 'ellipsis';
        parent.appendChild(elem);
        console.log(url.length, imageSeries[idx].url.length);
    });
}

export function makeNgUrlElems(ngUrls: RegularData[], parent: HTMLElement) {
    ngUrls.forEach((item, idx) => {
        const params = item.params;
        const {
            blue_max,
            blue_min,
            green_max,
            green_min,
            img_name,
            red_max,
            red_min,
            src_url,
            x_mm,
            y_mm,
            z_mm,
            cross_section_scale,
            layout,
            ome_zarr_shape,
        } = params;
        const elem = document.createElement('p');
        const url = getNeuroglancerUrl(
            src_url,
            img_name,
            x_mm,
            y_mm,
            z_mm,
            red_min,
            red_max,
            green_min,
            green_max,
            blue_min,
            blue_max,
            cross_section_scale,
            layout
        );
        elem.innerText = url;
        elem.style.maxWidth = '500px';
        elem.style.textWrap = 'nowrap';
        elem.style.overflow = 'hidden';
        elem.style.textOverflow = 'ellipsis';
        parent.appendChild(elem);
        console.log(url.length, ngUrls[idx].url.length);
    });
}

export function makeContactSheetElems(contactSheets: RegularData[], parent: HTMLElement) {
    contactSheets.forEach((item, idx) => {
        const params = item.params;
        const {
            blue_max,
            blue_min,
            green_max,
            green_min,
            img_name,
            red_max,
            red_min,
            src_url,
            x_mm,
            y_mm,
            z_mm,
            cross_section_scale,
            layout,
            ome_zarr_shape,
        } = params;
        if (ome_zarr_shape) {
            const elem = document.createElement('p');
            const url = getContactSheetUrl(
                src_url,
                img_name,
                ome_zarr_shape,
                x_mm,
                y_mm,
                z_mm,
                red_min,
                red_max,
                green_min,
                green_max,
                blue_min,
                blue_max,
                cross_section_scale
            );

            elem.innerText = url;
            elem.style.maxWidth = '500px';
            elem.style.textWrap = 'nowrap';
            elem.style.overflow = 'hidden';
            elem.style.textOverflow = 'ellipsis';
            parent.appendChild(elem);
            console.log(url.length, contactSheets[idx].url.length);
        }
    });
}
