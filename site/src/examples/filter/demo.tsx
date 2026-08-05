import { useCallback, useState } from 'react';
import { init,setupDemo } from './filter';
const NCELLS = 100000
const NEDGES = 100000

let runner: any = null;
let params = {
  minCorner: [0, 0],
  maxCorner: [1, 1],
  fromClass: 3,
  toClass: 4
}
init().then(d=>runner=setupDemo(d!, NEDGES, NCELLS))

export function Demo() {
  const [rows, setRows] = useState<Array<readonly number[]>>([])
  const [duration,setDuration] = useState<number>(Number.NaN)
  // const [params, setParams] = useState<Parameters<ReturnType<typeof setupDemo>>[0]>({
  //   minCorner: [0, 0],
  //   maxCorner: [1, 1],
  //   fromClass: 3,
  //   toClass: 4
  // });


  const clickme = useCallback(() => {
    if (runner) {
      const start = performance.now();
      runner(params, (rows) => {
        setDuration((performance.now()-start))
        setRows(rows)
      })
    }
  }, [runner,params])

  const handleSubmit = (e)=> {
      // Prevent the browser from reloading the page
    e.preventDefault();
    const newValue = JSON.parse(e.target.postContent.value)
    // setParams(newValue)
    params = newValue;
  }

  return (<div>
    <form method="post" onSubmit={handleSubmit}>

          <label>
        Edit the values of the filter (dont mess up):
          </label><br/>

            <textarea
              name="postContent"
              defaultValue={JSON.stringify(params)}
              rows={8}
              cols={40}
      />
            <br/>
          <button type="submit">update params</button>
    </form>

    <p>{rows.length} passing results out of {NEDGES} rows in the edges table:</p>
    <p>(filtering + gpu to cpu transfer + promise resolution delay) took ~ {duration} ms</p>




    <button onClick={clickme}>again!</button>
    <table>
      {rows.map((row, i) => (<tr key={i}>{row.map((cell,c)=>(<td key={`${i}_${c}`}>{cell}</td>))}</tr>))}
    </table>
  </div>)
}
