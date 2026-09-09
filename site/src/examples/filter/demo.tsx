import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { init, setupDemo } from './filter';
const NCELLS = 100000;
const NEDGES = 1000000;

let runner: ReturnType<typeof setupDemo>;

export function Demo() {
    const [rows, setRows] = useState<Array<readonly number[]>>([]);
    const [stats, setStats] = useState<number[][]>([]);
    const [duration, setDuration] = useState<number>(Number.NaN);
    const [gpuDuration, setGpuDuration] = useState<number>(Number.NaN);
    const [gpuAggregationDuration, setAggregationGpuDuration] = useState<number>(Number.NaN);
    const [params, setParams] = useState<Parameters<ReturnType<typeof setupDemo>>[0]>({
        minCorner: [0, 0, 0],
        maxCorner: [1, 1, 1],
        fromClass: 3,
        toClass: 4,
    });

    useEffect(() => {
        init().then((d) => (runner = setupDemo(d!, NEDGES, NCELLS)));
    }, []);

    const clickme = useCallback(() => {
        if (runner) {
            const start = performance.now();
            runner(params, (rows, stats, filterTime: number, aggTime: number) => {
                const wallTime = performance.now() - start;
                setGpuDuration(filterTime);
                setAggregationGpuDuration(aggTime);
                setStats(stats);
                setDuration(wallTime - (filterTime + aggTime));
                setRows(rows);
            });
        }
    }, [params]);

    const handleSubmit = (e: ChangeEvent<unknown>) => {
        // Prevent the browser from reloading the page
        e.preventDefault();
        if ('postContent' in e.target && typeof e.target.postContent === 'object' && e.target.postContent !== null) {
            const { postContent } = e.target;
            if ('value' in postContent) {
                const { value } = postContent;
                if (typeof value === 'string') {
                    const newValue = JSON.parse(value);
                    setParams(newValue);
                }
            }
        }
    };

    return (
        <div>
            <form
                method="post"
                onSubmit={handleSubmit}
            >
                <label>Edit the values of the filter (dont mess up):</label>
                <br />

                <textarea
                    name="postContent"
                    defaultValue={JSON.stringify(params)}
                    rows={8}
                    cols={40}
                />
                <br />
                <button type="submit">update params</button>
            </form>

            <p>
                {rows.length} passing results out of {NEDGES} rows in the edges table:
            </p>
            <p>
                filtering & aggregation took (compute + aggregate + overhead) ~ {gpuDuration.toFixed(3)} +
                {gpuAggregationDuration.toFixed(3)} + {duration.toFixed(3)} (
                {(gpuDuration + gpuAggregationDuration + duration).toFixed(4)} ms total)
            </p>

            <button onClick={clickme}>run!</button>
            <h3>stats (not filtered)</h3>
            <table>
                {stats.map((row) => (
                    <tr>
                        {row.map((s, c) => (
                            <td key={c}>{s}</td>
                        ))}
                    </tr>
                ))}
            </table>
            <h3>filtered rows</h3>
            <table>
                {rows.map((row, i) => (
                    <tr key={i}>
                        {row.map((cell, c) => (
                            <td key={`${i}_${c}`}>{cell}</td>
                        ))}
                    </tr>
                ))}
            </table>
        </div>
    );
}
