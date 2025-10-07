import { z } from 'zod';
import { logger } from '../logger';

export type WorkerMessage = {
    type: string;
};

export type WorkerMessageWithId = WorkerMessage & {
    id: string;
};

export const WorkerMessageSchema = z.object({
    type: z.string(),
});

export const WorkerMessageWithIdSchema = WorkerMessageSchema.extend({
    id: z.string().nonempty(),
});

export function isWorkerMessage(val: unknown): val is WorkerMessage {
    const { success, error } = WorkerMessageSchema.safeParse(val);
    if (error) {
        logger.warn('parsing WorkerMessage failed', error);
    }
    return success;
}

export function isWorkerMessageWithId(val: unknown): val is WorkerMessageWithId {
    const { success, error } = WorkerMessageWithIdSchema.safeParse(val);
    if (error) {
        logger.warn('parsing WorkerMessageWithId failed', error);
    }
    return success;
}

export type HeartbeatMessage = {
    type: 'heartbeat';
};

export const HeartbeatMessageSchema = z.object({
    type: z.literal('heartbeat'),
});

export function isHeartbeatMessage(val: unknown): val is HeartbeatMessage {
    const { success, error } = HeartbeatMessageSchema.safeParse(val);
    if (error) {
        logger.warn('parsing WorkerMessageWithId failed', error);
    }
    return success;
}

export const HEARTBEAT_RATE_MS = 500;
