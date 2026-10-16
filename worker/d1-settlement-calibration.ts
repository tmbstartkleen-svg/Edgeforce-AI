/** Isolated read-only D1 settlement and calibration evidence, never inferred outcomes. */
export type Statement={bind(...args:unknown[]):Statement;all<T>():Promise<{results:T[]}>};
export type D1Store={prepare(sql:string):Statement};
const store=(db:D1Store)=>{if(!db||typeof db.prepare!=='function')throw Error('D1_UNAVAILABLE');return db};
const key=(v:string)=>{if(typeof v!=='string'||!v.trim()||v.length>256)throw Error('INVALID_EVENT_ID');return v.trim()};
const bounded=(n:number)=>{if(!Number.isSafeInteger(n)||n<1||n>100)throw Error('INVALID_LIMIT');return n};
export async function readSettlements(db:D1Store,eventId:string,limit=50){
 const result=await store(db).prepare('SELECT id,model_run_id,event_id,market_key,selection_key,offered_odds,closing_odds,result,clv,pnl,settled_at FROM bet_results WHERE event_id=? ORDER BY id DESC LIMIT ?').bind(key(eventId),bounded(limit)).all<Record<string,unknown>>();
 return result.results.map(row=>({...row,dataSource:'STORED_SETTLEMENT',isLive:false}));
}
export async function readCalibration(db:D1Store,modelVersion:string,limit=50){
 if(typeof modelVersion!=='string'||!modelVersion.trim()||modelVersion.length>256)throw Error('INVALID_MODEL_VERSION');
 const result=await store(db).prepare('SELECT id,model_version,sport,market_key,sample_size,brier_score,log_loss,calibration_error,period_start,period_end,created_at FROM calibration_metrics WHERE model_version=? ORDER BY created_at DESC,id DESC LIMIT ?').bind(modelVersion.trim(),bounded(limit)).all<Record<string,unknown>>();
 return result.results.map(row=>({...row,dataSource:'STORED_CALIBRATION',isLive:false}));
}
