import { useCallback, useState } from 'react';
import { init,setupDemo } from './filter';
const NCELLS = 100000
const NEDGES = 100000

let runner: any = null;
init().then(d=>runner=setupDemo(d!, NEDGES, NCELLS))

export function Demo() {
  const [rows, setRows] = useState<Array<readonly number[]>>([])
  const [duration,setDuration] = useState<number>(Number.NaN)
  const [params, setParams] = useState<Parameters<ReturnType<typeof setupDemo>>[0]>({
    fromClass: 3,
    maxCorner: [1, 1],
    minCorner: [0, 0],
    toClass: 4
  });


  const clickme = useCallback(() => {
    if (runner) {
      const start = performance.now();
      runner(params, (rows) => {
        setDuration((performance.now()-start))
        setRows(rows)
      })
    }
  }, [runner,params])



  return (<div>
    <p>{rows.length} passing results out of {NEDGES} rows in the edges table:</p>
    <p>(filtering + gpu to cpu transfer + promise resolution delay) took ~ {duration} ms</p>
    <button onClick={clickme}>again!</button>
    <table>
      {rows.map((row, i) => (<tr key={i}>{row.map((cell,c)=>(<td key={`${i}_${c}`}>{cell}</td>))}</tr>))}
    </table>
  </div>)
}
