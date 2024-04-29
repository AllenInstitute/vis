import { getNeuroglancerUrl } from './utils';

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
    const argEl = document.getElementById('urlArgEl');
    const btnEl = document.getElementById('urlBtn');
    const outUrl = document.getElementById('goodUrl');
    const copyBtn = document.getElementById('copyBtn');
    if (argEl && btnEl && outUrl && copyBtn) {
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
    }
}

demoTime();
