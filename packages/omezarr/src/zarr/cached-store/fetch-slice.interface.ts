import type { AbsolutePath, RangeQuery } from 'zarrita';
import z from 'zod';

export type TransferrableRequestInit = Omit<RequestInit, 'body' | 'headers' | 'signal'> & {
    body?: string;
    headers?: [string, string][] | Record<string, string>;
};

export type FetchSliceMessagePayload = {
    rootUrl: string;
    path: AbsolutePath;
    range: RangeQuery;
    options?: TransferrableRequestInit | undefined;
};

export const FETCH_SLICE_MESSAGE_TYPE = 'fetch-slice' as const;
export const FETCH_SLICE_RESPOSNE_MESSAGE_TYPE = 'fetch-slice-response' as const;
export const CANCEL_MESSAGE_TYPE = 'cancel' as const;

export type FetchSliceMessage = {
    type: typeof FETCH_SLICE_MESSAGE_TYPE;
    id: string;
    payload: FetchSliceMessagePayload;
};

export type FetchSliceResponseMessage = {
    type: typeof FETCH_SLICE_RESPOSNE_MESSAGE_TYPE;
    id: string;
    payload: ArrayBufferLike | undefined;
};

export type CancelMessage = {
    type: typeof CANCEL_MESSAGE_TYPE;
    id: string;
};

const FetchSliceMessagePayloadSchema = z.object({
    rootUrl: z.string().nonempty(),
    path: z.string().nonempty().startsWith('/'),
    range: z.union([
        z.object({
            offset: z.number(),
            length: z.number(),
        }),
        z.object({
            suffixLength: z.number(),
        }),
    ]),
    options: z.unknown().optional(), // being "lazy" for now; doing a full schema for this could be complex and fragile
});

const FetchSliceMessageSchema = z.object({
    type: z.literal(FETCH_SLICE_MESSAGE_TYPE),
    id: z.string().nonempty(),
    payload: FetchSliceMessagePayloadSchema,
});

const FetchSliceResponseMessageSchema = z.object({
    type: z.literal(FETCH_SLICE_RESPOSNE_MESSAGE_TYPE),
    id: z.string().nonempty(),
    payload: z.unknown().optional(), // unclear if it's feasible/wise to define a schema for this one
});

const CancelMessageSchema = z.object({
    type: z.literal(CANCEL_MESSAGE_TYPE),
    id: z.string().nonempty(),
});

export function isFetchSliceMessage(val: unknown): val is FetchSliceMessage {
    return FetchSliceMessageSchema.safeParse(val).success;
}

export function isFetchSliceResponseMessage(val: unknown): val is FetchSliceResponseMessage {
    return FetchSliceResponseMessageSchema.safeParse(val).success;
}

export function isCancelMessage(val: unknown): val is CancelMessage {
    return CancelMessageSchema.safeParse(val).success;
}

export function isCancellationError(err: unknown): boolean {
    return (
        err === 'cancelled' ||
        (typeof err === 'object' &&
            err !== null &&
            (('name' in err && err.name === 'AbortError') || ('code' in err && err.code === 20)))
    );
}
