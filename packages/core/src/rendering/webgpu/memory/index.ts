/**
 * @module memory
 *
 * GPU buffer pooling: the `BufferManager` interface and the batch-pool implementation.
 */
// Base API

// Batch Pool implementation
export { BatchPoolBufferManager as BatchPoolBufferAdapter } from './batch-pool/batch-pool-buffer-manager';
export { OutOfBucketError } from './batch-pool/errors';
export { InvalidHandleError, OutOfBudgetError } from './errors';
export type {
    BatchEventInfo,
    BufferHandle,
    BufferManager,
    BufferManagerConfig,
    BufferManagerStats,
    BufferManagerTelemetry,
    BufferUsageFlags,
    MissEventInfo,
    PoolStats,
} from './types';
export { BufferManagerBase } from './types';
