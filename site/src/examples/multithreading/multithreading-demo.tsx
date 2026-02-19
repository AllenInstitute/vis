import { WorkerPool, type WorkerStatus } from '@alleninstitute/vis-core';
import { useEffect, useState } from 'react';

export function MultithreadingDemo() {
    const [numWorkers, setNumWorkers] = useState<number>(0);
    const [workerPool, setWorkerPool] = useState<WorkerPool | null>(null);
    const [editingWorkers, setEditingWorkers] = useState<boolean>(true);
    const [currentStatuses, setCurrentStatuses] = useState<ReadonlyMap<number, WorkerStatus> | null>(null);
    const [currentStatusKeys, setCurrentStatusKeys] = useState<number[]>([]);

    /*
    PLAN:
    - [DONE] allow users to choose how many workers are in the pool (only while no requests are pending)
    - [DONE] display the health and status of each worker in the pool
    - specify some parameters for each request:
        - duration of request
        - type of message
        - message contents (except ID)
        = workers receiving such a message will wait for the specified length of time, then respond with the message contents
    - experiment with creating a heartbeat signal -- will they respond while they're awaiting a timeout?=
    */

    useEffect(() => {
        const interval = setInterval(() => {
            const statuses = workerPool?.getStatuses() ?? null;
            setCurrentStatuses(statuses);
            const statusKeys = Array.from(statuses?.keys() ?? []);
            setCurrentStatusKeys(statusKeys);
        }, 100);

        return () => {
            clearInterval(interval);
        };
    }, [workerPool]);

    const workerModule = new URL('./multithreading.worker.ts', import.meta.url);
    const updateWorkers = () => {
        setEditingWorkers(false);
        setWorkerPool(new WorkerPool(numWorkers, workerModule));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                <span style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                    Number of Workers:
                </span>
                {editingWorkers ? (
                    <span style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                        <input
                            type="text"
                            value={numWorkers}
                            onChange={(e) => setNumWorkers(Number.parseInt(e.target.value, 10))}
                        />
                        <button type="button" onClick={updateWorkers}>
                            Update
                        </button>
                    </span>
                ) : (
                    <span style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                        {numWorkers}
                        <button type="button" onClick={() => setEditingWorkers(true)}>
                            Edit
                        </button>
                    </span>
                )}
            </div>
            <div>
                {(currentStatusKeys ?? []).map((key) => (
                    <div
                        key={key}
                        style={{ padding: '4px', borderRadius: '3px', backgroundColor: 'rgb(255 255 255 / 5%)' }}
                    >
                        {currentStatuses?.get(key) ?? 'Undefined'}
                    </div>
                ))}
            </div>
        </div>
    );
}
