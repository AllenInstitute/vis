// Base API
export { InvalidHandleError, OutOfBudgetError } from './errors';
export type {
    BatchEventInfo,
    BufferManager,
    BufferManagerConfig,
    BufferManagerStats,
    BufferManagerTelemetry,
    BufferHandle,
    BufferUsageFlags,
    MissEventInfo,
    PoolStats,
} from './types';
export { BufferManagerBase } from './types';

// Batch Pool implementation
export { BatchPoolBufferManager as BatchPoolBufferAdapter } from './batch-pool/batch-pool-buffer-manager';
export { OutOfBucketError } from './batch-pool/errors';
