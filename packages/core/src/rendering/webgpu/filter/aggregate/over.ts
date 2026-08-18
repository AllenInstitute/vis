import type { BufferTables, ColumnExpr, IndexExpr, ScalarType, Tables, WgslType } from '../types'
import { type Agg, generateAggregationShader } from './gen';
import { buildFilterPipeline } from '../build'
// the idea is to piggy back off the given(tableSpec) function,

// but go sideways into a path that provides very simple aggregation

// given({}).from(edges).over()
// over must be given up to 2 table/column expressions, this will determine the size and rank of the histogram (1D) / heatmap(2D) result
// .min(expr)
// .max(expr)
// .sum(expr)
// .count()
type AggregationSubject<Ts extends Tables, From extends keyof Ts, O extends keyof Ts> =
  From extends string ?
  O extends string ?
  keyof Ts[From] extends string ?
  keyof Ts[O] extends string?
  IndexExpr<O,string, ScalarType> |
  ColumnExpr<From,string, ScalarType>
  : never : never : never : never

// good enough for me


// this being a class makes vite build some total nonsense in types.d.ts...
// it would (for totally silly reasons) probably work fine if it were defined in query.ts
// export class Aggregation<Ts extends Tables, From extends keyof Ts, Aggs extends Record<string,Agg>> {
//   constructor(readonly fields: Aggs) {
//   }
//   // todo - consider push();return this
//   min<K extends string, O extends keyof Ts>(key:K, s:AggregationSubject<Ts,From,O>) {
//     return new Aggregation < Ts, From, Aggs & Record<K,Agg>>({...this.fields,[key]:{kind:'min',expr:s}})
//   }
//   max<K extends string,O extends keyof Ts>(key:K, s: AggregationSubject<Ts, From, O>) {
//     return new Aggregation< Ts, From, Aggs & Record<K,Agg>>({...this.fields,[key]:{kind:'max',expr:s}})
//   }
//   sum<K extends string,O extends keyof Ts>(key:K, s:AggregationSubject<Ts,From,O>) {
//     return new Aggregation< Ts, From, Aggs & Record<K,Agg>>({...this.fields,[key]:{kind:'sum',expr:s}})
//   }
//   count<K extends string>(key:K) {
//     return new Aggregation< Ts, From, Aggs & Record<K,Agg>>({...this.fields,[key]:{kind:'count'}})
//   }

// }
// type Aggregation<Ts extends Tables, From extends keyof Ts, Aggs extends Record<string, Agg>> = {
//   fields: Aggs,

// }
export function aggregation<Ts extends Tables, From extends keyof Ts, Aggs extends Record<string, Agg>>(fields: Aggs):
Aggregation<Ts,From,Aggs>  {
  return {
    fields,
    min: <K extends string, O extends keyof Ts>(key: K, s: AggregationSubject<Ts, From, O>) => {
      return aggregation< Ts, From, Aggs & Record<K,Agg>>({...fields,[key]:{kind:'min',expr:s}})
    },
    max: <K extends string, O extends keyof Ts>(key: K, s: AggregationSubject<Ts, From, O>) => {
      return aggregation< Ts, From, Aggs & Record<K,Agg>>({...fields,[key]:{kind:'max',expr:s}})
    },
    sum: <K extends string, O extends keyof Ts>(key: K, s: AggregationSubject<Ts, From, O>) => {
      return aggregation< Ts, From, Aggs & Record<K,Agg>>({...fields,[key]:{kind:'sum',expr:s}})
    },
    count: <K extends string>(key: K,) => {
      return aggregation< Ts, From, Aggs & Record<K,Agg>>({...fields,[key]:{kind:'count'}})
    }
  }
}
export type Aggregation<Ts extends Tables, From extends keyof Ts, Aggs extends Record<string, Agg>> = {
  fields: Aggs,
  min: <K extends string, O extends keyof Ts>(key: K, s: AggregationSubject<Ts, From, O>) => Aggregation<Ts, From, Aggs & Record<K, Agg>>
  max: <K extends string, O extends keyof Ts>(key: K, s: AggregationSubject<Ts, From, O>) => Aggregation<Ts, From, Aggs & Record<K, Agg>>
  sum: <K extends string, O extends keyof Ts>(key: K, s: AggregationSubject<Ts, From, O>) => Aggregation<Ts, From, Aggs & Record<K, Agg>>
  count: <K extends string>(key: K) =>Aggregation<Ts,From,Aggs&Record<K,Agg>>
}

type GroupSubject<Ts extends Tables, From extends keyof Ts, O extends keyof Ts> =
  IndexExpr<O&string, string, 'u32'> |
  ColumnExpr<From&string,string, 'u32'>


// function aggregator<Ts extends Tables, From extends keyof Ts>() {
//   const fields: Agg[]=[]
//   const thing= {
//     min<O extends keyof Ts>(s: AggregationSubject<Ts, From, O>) {
//       // return new Aggregation([...this.fields,{kind:'min',expr:s}])
//       fields.push({kind:'min',expr:s})
//       return thing;
//     },
//     max<O extends keyof Ts>(s: AggregationSubject<Ts, From, O>) {
//       // return new Aggregation([...this.fields,{kind:'max',expr:s}])
//       fields.push({kind:'max',expr:s})
//       return thing;
//     },
//     sum<O extends keyof Ts>(s:AggregationSubject<Ts,From,O>) {
//       // return new Aggregation([...this.fields,{kind:'sum',expr:s}])
//       fields.push({kind:'sum',expr:s})
//       return thing;
//     },
//     count() {
//       // return new Aggregation([...this.fields,{kind:'count'}])
//       fields.push({kind:'count',})
//       return thing;
//     },
//   }
//   return {thing,fields};
// }
const entries = <T extends {}>(r: T): ReadonlyArray<[string, T[keyof T]]> => Object.entries(r);
function mapTablesToBindings<Ts extends Tables>(
    tables: BufferTables<Ts>,
    lookups: Record<string, Record<string, number>>
): { resource: GPUBuffer; binding: number }[] {
    return entries(tables)
        .flatMap(([name, table]) => {
            return entries(table).map(([field, buffer]) => {
                const b = lookups[name]?.[field];
                if (b) {
                    return { resource: buffer as GPUBuffer, binding: b };
                }
                return undefined;
            });
        })
        .filter((x) => x !== undefined);
}
type Buffers<T extends {}> = {[k in keyof T]:GPUBuffer}
export function setupAggregator<Ts extends Tables, From extends keyof Ts>(tables: Ts, from: From & string) {
  function aggregate() {
    return aggregation<Ts, From, {}>({})
  }
  function groupBy<Ts extends Tables, From extends keyof Ts, A extends keyof Ts,Aggs extends Record<string,Agg>>(
    groupBy: GroupSubject<Ts, From, A>,
    aggregator:Aggregation<Ts,From,Aggs>
  ) {
    return {
      build: (device: GPUDevice,) => {
        const shader = generateAggregationShader(false, tables, from, Object.values(aggregator.fields), groupBy);
        const pipe = buildFilterPipeline(device, shader, 'main', 'todo');
        // type ResultBindings = {[K in keyof Aggs]:GPUBuffer}
        let columnBindings: Record<string, Record<string, number>> = {};
        // let outputBindings: Record<string,number> = {};
        // associate a binding with every field of every table
        let binding = 1; // elements (optional) takes up group 1 binding 0
        for (const t of Object.keys(tables)) {
            columnBindings[t] = {};
            for (const col of Object.keys(tables[t]!)) {
                columnBindings[t]![col] = binding;
                binding += 1;
            }
        }
        // for (const t of Object.keys(aggregator.fields)) {
        //   outputBindings[t] = binding;
        //   binding+=1
        // }

        const runner = (enc:GPUCommandEncoder, inputs: BufferTables<Ts>, results: GPUBuffer,locks:GPUBuffer, dimensions:GPUBuffer, rowCount:number) => {
          // create bind groups for inputs / results
          // bind dimensions uniform
          const bg0 = device.createBindGroup({
            layout: pipe.pipeline.getBindGroupLayout(0),
            entries: [{ resource: dimensions, binding: 0 },
              { resource: results, binding:1 },
              { resource: locks, binding: 2 }

            ]
          });
          const bg1=device.createBindGroup({
            layout: pipe.pipeline.getBindGroupLayout(1),
            entries:mapTablesToBindings(inputs, columnBindings)
            // entries: [...mapTablesToBindings(inputs, columnBindings), 
            //   ...entries(results).map(([k, v]) => {
            //   return {resource:v,binding:outputBindings[k]}
            // })]
          })

          // do the thing!
          const pass = enc.beginComputePass();
          pass.setPipeline(pipe.pipeline);
          pass.setBindGroup(0, bg0);
          pass.setBindGroup(1, bg1);
          const disp = Math.ceil(rowCount/64)

          console.log('workgroup dispatches:',disp)
          pass.dispatchWorkgroups(disp)
          pass.end();
        }
        return {run:runner}
        }
      }
  }
  // function mapBy<Ts extends Tables, From extends keyof Ts, A extends keyof Ts, B extends keyof Ts>(
  //   rows: GroupSubject<Ts, From, A>,
  //   cols: GroupSubject<Ts, From, B>
  // ) {
  //   return {
  //     ...aggregator(), build: (rows: number, cols: number) => {

  //     }
  //   }
  // }
  return {groupBy,aggregate}
}
