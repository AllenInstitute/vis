import { z } from 'zod';

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
    return WorkerMessageSchema.safeParse(val).success;
}

export function isWorkerMessageWithId(val: unknown): val is WorkerMessageWithId {
    return WorkerMessageWithIdSchema.safeParse(val).success;
}
