/** Staged D1 simulation-history reader. Not routed from production or public pilot. */
export type D1Stmt={bind(...args:unknown[]):D1Stmt;all<T>():Promise<{results:T[]}>;run():Promise<unknown>};
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

/** Append one stored model run. Caller must use independently verified model output. */
export type NewModelRun={event_id:string;market_key:string;selection_key:string;model_version:string;run_count:number;market_probability:number;model_probability:number;confidence?:number|null;feature_snapshot:Record<string,unknown>;created_at:string};
const textKey=(s:string,name:string)=>{if(typeof s!=='string'||!s.trim()||s.length>256)throw new Error('INVALID_'+name);return s.trim()};
const probability=(n:number,name:string)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)throw new Error('INVALID_'+name);return n};
export async function insertStoredModelRun(db:D1Database,run:NewModelRun){
 if(!db||typeof db.prepare!=='function')throw new Error('D1_UNAVAILABLE');
 if(!Number.isSafeInteger(run.run_count)||run.run_count<1||run.run_count>10000000)throw new Error('INVALID_RUN_COUNT');
 const timestamp=Date.parse(run.created_at);if(!Number.isFinite(timestamp))throw new Error('INVALID_TIMESTAMP');
 if(!run.feature_snapshot||typeof run.feature_snapshot!=='object'||Array.isArray(run.feature_snapshot))throw new Error('INVALID_FEATURE_SNAPSHOT');
 const snapshot=JSON.stringify(run.feature_snapshot);
 if(!snapshot||new TextEncoder().encode(snapshot).length>32768)throw new Error('INVALID_FEATURE_SNAPSHOT_SIZE');
 await db.prepare('INSERT INTO model_runs (event_id,market_key,selection_key,model_version,run_count,market_probability,model_probability,confidence,feature_snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
 .bind(textKey(run.event_id,'EVENT_ID'),textKey(run.market_key,'MARKET_KEY'),textKey(run.selection_key,'SELECTION_KEY'),textKey(run.model_version,'MODEL_VERSION'),run.run_count,probability(run.market_probability,'MARKET_PROBABILITY'),probability(run.model_probability,'MODEL_PROBABILITY'),run.confidence==null?null:probability(run.confidence,'CONFIDENCE'),snapshot,new Date(timestamp).toISOString()).run();
}
