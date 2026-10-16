/** Staged D1 simulation-history reader. Not routed from production or public pilot. */
export type D1Stmt={bind(...args:unknown[]):D1Stmt;all<T>():Promise<{results:T[]}>};
export type D1Database={prepare(sql:string):D1Stmt};
const id=(s:string)=>{if(typeof s!=='string'||!s.trim()||s.length>256)throw new Error('INVALID_EVENT_ID');return s.trim()};
export type ModelRunRow={id:number;event_id:string;market_key:string;selection_key:string;model_version:string;run_count:number;market_probability:number;model_probability:number;confidence:number|null;created_at:string;feature_snapshot:string};
export async function readModelRuns(db:D1Database,eventId:string,limit=25){
 if(!db||typeof db.prepare!=='function')throw new Error('D1_UNAVAILABLE');
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('INVALID_LIMIT');
 const rows=await db.prepare('SELECT id,event_id,market_key,selection_key,model_version,run_count,market_probability,model_probability,confidence,created_at,feature_snapshot FROM model_runs WHERE event_id=? ORDER BY created_at DESC,id DESC LIMIT ?').bind(id(eventId),limit).all<ModelRunRow>();
 return rows.results.map(row=>{
  const snapshot=JSON.parse(row.feature_snapshot);
  if(!Number.isFinite(row.market_probability)||!Number.isFinite(row.model_probability)||row.market_probability<0||row.market_probability>1||row.model_probability<0||row.model_probability>1)throw new Error('INVALID_STORED_PROBABILITY');
  return {...row,feature_snapshot:snapshot,modelSource:'STORED_RUN',isLiveInference:false};
 });
}
