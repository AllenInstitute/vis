export type WorkerMessage = {
    type: string;
};

export type WorkerMessageWithId = WorkerMessage & {
    id: string;
};

export function isWorkerMessage(val: unknown): val is WorkerMessage {
    return (
        val !== undefined &&
        val !== null &&
        typeof val === 'object' &&
        'type' in val &&
        typeof val.type === 'string' &&
        val.type.length > 0
    );
}

export function isWorkerMessageWithId(val: unknown): val is WorkerMessageWithId {
    return isWorkerMessage(val) && 'id' in val && typeof val.id === 'string' && val.id.length > 0;
}

export type HeartbeatMessage = {
    type: 'heartbeat';
};

export function isHeartbeatMessage(val: unknown): val is HeartbeatMessage {
    return isWorkerMessage(val) && val.type === 'heartbeat';
}

export const HEARTBEAT_RATE_MS = 500;
