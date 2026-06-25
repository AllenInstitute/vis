import { BufferUsageFlags } from "../types";

/**
 * Thrown by `acquire()` when the requested `sizeBytes` exceeds the largest configured bucket.
 * Indicates the caller's `sizeBuckets` list does not cover the working set; either widen the
 * bucket list at construction time or refactor the caller to use smaller buffers.
 */
export class OutOfBucketError extends Error {
    readonly name = 'OutOfBucketError';
    constructor(
        public readonly requestedBytes: number,
        public readonly usage: BufferUsageFlags,
        public readonly largestBucket: number
    ) {
        super(
            `BufferAdapter: requested ${requestedBytes} bytes (usage 0x${usage.toString(16)}) ` +
                `exceeds the largest configured bucket (${largestBucket} bytes).`
        );
    }
}
