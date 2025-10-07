import { HEARTBEAT_RATE_MS } from '@alleninstitute/vis-core';

self.setInterval(() => {
    self.postMessage({ type: 'heartbeat' });
}, HEARTBEAT_RATE_MS);

self.onmessage = (e: MessageEvent<unknown>) => {
    self.postMessage(e);
};
