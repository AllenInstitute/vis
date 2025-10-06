import { z } from 'zod';
import { logger } from '../logger';

export type WorkerMessage = {
    type: string;
};

export type WorkerMessageWithId = WorkerMessage & {
    id: string;
};

const WorkerMessageSchema = z.object({
    type: z.string(),
});

const WorkerMessageWithIdSchema = WorkerMessageSchema.extend({
    id: z.string().nonempty(),
});

export function isWorkerMessage(val: unknown): val is WorkerMessage {
    const { success, error } = WorkerMessageSchema.safeParse(val);
    if (error) {
        logger.error('parsing WorkerMessage failed', error);
    }
    return success;
}

export function isWorkerMessageWithId(val: unknown): val is WorkerMessageWithId {
    const { success, error } = WorkerMessageWithIdSchema.safeParse(val);
    if (error) {
        logger.error('parsing WorkerMessageWithId failed', error);
    }
    return success;
}
