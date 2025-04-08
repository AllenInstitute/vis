import { VisError } from "./errors";

const RESOURCE_TYPE_S3 = 's3' as const;
const RESOURCE_TYPE_HTTPS = 'https' as const;

export type HttpsResource = {
    type: typeof RESOURCE_TYPE_HTTPS;
    url: string;
};

export type S3Resource = {
    type: typeof RESOURCE_TYPE_S3;
    url: string;
    region: string;
}

export type WebResource = HttpsResource | S3Resource;

const S3_REGION_BASIC_REGEX = /[a-z]+-[a-z]+-[1-9]/;

function httpsFromS3Bucket(url: string, region: string) {
    // maybe region is controlled via the url or another arg in the future, so lets make it a variable
    const endOfBucket = url.indexOf('/', 5);
    const bucket = url.slice(5, endOfBucket);
    const path = url.slice(endOfBucket + 1);

    return `https://${bucket}.s3.${region}.amazonaws.com/${path}`;
}

function isValidS3URL(url: string): boolean {
    return !!url && url.length >= 6 && url.slice(0, 5) === 's3://';
}

function isValidS3Region(region: string): boolean {
    return !!region && S3_REGION_BASIC_REGEX.test(region);
}

export function getResourceUrl(res: WebResource): string {
    if (res.type === 's3') {
        if (!isValidS3URL(res.url)) {
            throw new VisError('cannot get WebResource URL: invalid S3 URL');
        }
        if (!isValidS3Region(res.region)) {
            throw new VisError('cannot get WebResource URL: invalid S3 Region');
        }
        return httpsFromS3Bucket(res.url, res.region);
    }
    return res.url;
}
