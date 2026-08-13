import type { ColumnExpr, IndexExpr, ScalarType, Tables, WgslType } from '../types'
import { Agg } from './gen';
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
  IndexExpr<O, keyof Ts[O], ScalarType> |
  ColumnExpr<From, keyof Ts[From], ScalarType>
  : never : never : never : never

// lets test it real quick
function stuff<Ts extends Tables, From extends keyof Ts, O extends keyof Ts>
  (args: AggregationSubject<Ts, From, O>) {
    return args.kind
  }
const what = { cells: { A: 'u32', B: 'f32' }, edges: { e: 'vec2u', str: 'f32' } } as const;
type T = typeof what;
stuff<T, 'edges', 'cells'>({ kind: 'table at field', table: 'cells', field: 'A', atExpr: 'hi mom', type: 'vec2u' })
// good enough for me



// export class Aggregation<Ts extends Tables, From extends keyof Ts> {
//   constructor(readonly fields: Agg[]) {
//   }
//   // todo - consider push();return this
//   min<O extends keyof Ts>(s:AggregationSubject<Ts,From,O>) {
//     return new Aggregation([...this.fields,{kind:'min',expr:s}])
//   }
//   max<O extends keyof Ts>(s: AggregationSubject<Ts, From, O>) {
//     return new Aggregation([...this.fields,{kind:'max',expr:s}])
//   }
//   sum<O extends keyof Ts>(s:AggregationSubject<Ts,From,O>) {
//     return new Aggregation([...this.fields,{kind:'sum',expr:s}])
//   }
//   count() {
//     return new Aggregation([...this.fields,{kind:'count'}])
//   }
//   build() {

//   }
// }

type GroupSubject<Ts extends Tables, From extends keyof Ts, O extends keyof Ts> =
  From extends string ?
  O extends string ?
  keyof Ts[From] extends string ?
  keyof Ts[O] extends string?
  IndexExpr<O, keyof Ts[O], 'u32'> |
  ColumnExpr<From, keyof Ts[From], 'u32'>
  : never : never : never : never


function aggregator<Ts extends Tables, From extends keyof Ts>() {
  const fields: Agg[]=[]
  const thing= {
    min<O extends keyof Ts>(s: AggregationSubject<Ts, From, O>) {
      // return new Aggregation([...this.fields,{kind:'min',expr:s}])
      fields.push({kind:'min',expr:s})
      return thing;
    },
    max<O extends keyof Ts>(s: AggregationSubject<Ts, From, O>) {
      // return new Aggregation([...this.fields,{kind:'max',expr:s}])
      fields.push({kind:'max',expr:s})
      return thing;
    },
    sum<O extends keyof Ts>(s:AggregationSubject<Ts,From,O>) {
      // return new Aggregation([...this.fields,{kind:'sum',expr:s}])
      fields.push({kind:'sum',expr:s})
      return thing;
    },
    count() {
      // return new Aggregation([...this.fields,{kind:'count'}])
      fields.push({kind:'count',})
      return thing;
    },
  }
  return thing;
}

function groupBy<Ts extends Tables, From extends keyof Ts, A extends keyof Ts>(
  groupBy: GroupSubject<Ts,From,A>
) {
  return {
    ...aggregator(), build: (dim: number) => {

  }}
}
function mapBy<Ts extends Tables, From extends keyof Ts, A extends keyof Ts, B extends keyof Ts>(
  rows: GroupSubject<Ts, From, A>,
  cols: GroupSubject<Ts,From,B>
) {
  return {
    ...aggregator(), build: (rows:number,cols:number) => {

  }}
}
