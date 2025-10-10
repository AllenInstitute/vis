import type { AbsolutePath, RangeQuery } from 'zarrita';
import z from 'zod';

export type TransferrableRequestInit = Omit<RequestInit, 'body' | 'headers' | 'signal'> & {
    body?: string;
    headers?: [string, string][] | Record<string, string>;
};

export type FetchMessagePayload = {
    rootUrl: string;
    path: AbsolutePath;
    range?: RangeQuery | undefined; 
    options?: TransferrableRequestInit | undefined;
};

export const FETCH_MESSAGE_TYPE = 'fetch' as const;
export const FETCH_RESPONSE_MESSAGE_TYPE = 'fetch-response' as const;
export const CANCEL_MESSAGE_TYPE = 'cancel' as const;

export type FetchMessage = {
    type: typeof FETCH_MESSAGE_TYPE;
    id: string;
    payload: FetchMessagePayload;
};

export type FetchResponseMessage = {
    type: typeof FETCH_RESPONSE_MESSAGE_TYPE;
    id: string;
    payload: ArrayBufferLike | undefined;
};

export type CancelMessage = {
    type: typeof CANCEL_MESSAGE_TYPE;
    id: string;
};

const FetchMessagePayloadSchema = z.object({
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
    ]).optional(),
    options: z.unknown().optional(), // being "lazy" for now; doing a full schema for this could be complex and fragile
});

const FetchMessageSchema = z.object({
    type: z.literal(FETCH_MESSAGE_TYPE),
    id: z.string().nonempty(),
    payload: FetchMessagePayloadSchema,
});

const FetchResponseMessageSchema = z.object({
    type: z.literal(FETCH_RESPONSE_MESSAGE_TYPE),
    id: z.string().nonempty(),
    payload: z.unknown().optional(), // unclear if it's feasible/wise to define a schema for this one
});

const CancelMessageSchema = z.object({
    type: z.literal(CANCEL_MESSAGE_TYPE),
    id: z.string().nonempty(),
});

export function isFetchMessage(val: unknown): val is FetchMessage {
    return FetchMessageSchema.safeParse(val).success;
}

export function isFetchResponseMessage(val: unknown): val is FetchResponseMessage {
    return FetchResponseMessageSchema.safeParse(val).success;
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
