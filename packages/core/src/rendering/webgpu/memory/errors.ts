/**
 * Thrown by `acquire()` when a request cannot be satisfied within the configured `maxBytes`
 * budget, even after attempting to reclaim idle entries.
 */
export class OutOfBudgetError extends Error {
    readonly name = 'OutOfBudgetError';
    constructor(
        public readonly residentBytes: number,
        public readonly maxBytes: number,
        public readonly requestedBytes: number
    ) {
        super(
            `BufferAdapter: cannot allocate ${requestedBytes} bytes; ` +
                `resident ${residentBytes} / max ${maxBytes}. ` +
                'Reclaimable idle entries (if any) were already evicted.'
        );
    }
}

/**
 * Thrown by `release()` when the supplied handle is not currently owned by the adapter (foreign
 * handle, double-release, or use-after-dispose).
 */
export class InvalidHandleError extends Error {
    readonly name = 'InvalidHandleError';
    constructor(reason: 'foreign' | 'double-release') {
        super(`BufferAdapter: invalid handle (${reason}).`);
    }
}

/**
 * Thrown whenever an operation is attempted on a buffer that has already been disposed.
 */
export class DisposedBufferError extends Error {
    readonly name = 'DisposedBufferError';
    constructor() {
        super("BufferAdapter: operation attempted on a disposed buffer.");
    }
}

