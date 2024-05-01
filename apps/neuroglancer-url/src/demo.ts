import type { ImageSeriesData, NGData, RegularData } from './types';
import { getNeuroglancerUrl } from './utils';
import { data } from './data';
import { getContactSheetUrl } from './contact-sheet';
import { makeContactSheetElems, makeImageSeriesElems, makeNgUrlElems } from './url-elem-maker';

interface NeuroglancerUrl {
    srcUrl: string;
    imgName: string;
    xMm: number;
    yMm: number;
    zMm: number;
    redMin: number;
    redMax: number;
    greenMin: number;
    greenMax: number;
    blueMin: number;
    blueMax: number;
    crossSectionScale?: number;
    layout?: string;
}

const jsonFormat = {
    input: {
        srcUrl: '',
        imgName: '',
        xMm: 0,
        yMm: 0,
        zMm: 0,
        redMin: 0,
        redMax: 255,
        greenMin: 0,
        greenMax: 255,
        blueMin: 0,
        blueMax: 255,
        crossSectionScale: 50.0,
        layout: '4panel',
    },
    output: 'neuroglancer.com/urlstuff',
};

const defaultNeuroglancerUrl: NeuroglancerUrl = {
    srcUrl: '',
    imgName: '',
    xMm: 0,
    yMm: 0,
    zMm: 0,
    redMin: 0,
    redMax: 255,
    greenMin: 0,
    greenMax: 255,
    blueMin: 0,
    blueMax: 255,
    crossSectionScale: 50.0,
    layout: '4panel',
};
function demoTime() {
    let imageSeries: ImageSeriesData[] = [];
    let contactSheets: RegularData[] = [];
    let ngURLs: RegularData[] = [];

    data.forEach((item) => {
        switch (item.function) {
            case 'get_image_series_grid_url':
                imageSeries.push(item as ImageSeriesData);
                break;
            case 'get_contact_sheet_url':
                contactSheets.push(item as RegularData);
                break;
            case 'get_neuroglancer_url':
                ngURLs.push(item as RegularData);
                break;
        }
    });

    const argEl = document.getElementById('urlArgEl');
    const btnEl = document.getElementById('urlBtn');
    const outUrl = document.getElementById('goodUrl');
    const copyBtn = document.getElementById('copyBtn');
    const ngUrlParent = document.getElementById('ngUrls');
    const contactParent = document.getElementById('contacts');
    const imageParent = document.getElementById('imageSeries');
    if (argEl && btnEl && outUrl && copyBtn && ngUrlParent && contactParent && imageParent) {
        const fields = document.createElement('ol');
        const fieldItems = Object.entries(defaultNeuroglancerUrl).map(([name, val]) => {
            const listEl = document.createElement('li');
            const pEl = document.createElement('p');
            const text = document.createElement('input');
            text.type = 'text';
            text.value = val;
            // @ts-expect-error
            text.onchange = (e) => (defaultNeuroglancerUrl[name] = val);

            pEl.innerText = name;
            listEl.id = name;

            listEl.appendChild(pEl);
            listEl.appendChild(text);
            fields.appendChild(listEl);
        });
        argEl.appendChild(fields);
        btnEl.addEventListener('click', (e) => {
            const {
                srcUrl,
                imgName,
                xMm,
                yMm,
                zMm,
                redMin,
                redMax,
                greenMin,
                greenMax,
                blueMin,
                blueMax,
                crossSectionScale,
                layout,
            } = defaultNeuroglancerUrl;
            outUrl.innerText = getNeuroglancerUrl(
                srcUrl,
                imgName,
                xMm,
                yMm,
                zMm,
                redMin,
                redMax,
                greenMin,
                greenMax,
                blueMin,
                blueMax,
                crossSectionScale,
                layout
            );
        });
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(outUrl.innerText);
        });

        makeNgUrlElems(ngURLs, ngUrlParent);
        makeContactSheetElems(contactSheets, contactParent);
        makeImageSeriesElems(imageSeries, imageParent);
    }
}

demoTime();
