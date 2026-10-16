/** Staged D1 market snapshot persistence. Not wired to production routes. */
export type D1Query={bind(...values:unknown[]):D1Query;first<T=unknown>():Promise<T|null>;all<T=unknown>():Promise<{results:T[]}>;run():Promise<unknown>};
export type D1Store={prepare(sql:string):D1Query};
export type MarketSnapshot={event_id:string;provider:string;bookmaker:string;market_key:string;selection_key:string;american_odds:number;point?:number|null;pulled_at:string;raw?:unknown};
const required=(s:string,name:string)=>{if(typeof s!=='string'||!s.trim()||s.length>256)throw Error('INVALID_'+name);return s.trim()};
const iso=(s:string)=>{const d=Date.parse(s);if(!Number.isFinite(d))throw Error('INVALID_TIMESTAMP');return new Date(d).toISOString()};
const safeDb=(d:D1Store)=>{if(!d||typeof d.prepare!=='function')throw Error('D1_NOT_BOUND');return d};
const finite=(v:number,name:string)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error('INVALID_'+name);return v};
export async function insertMarketSnapshot(db:D1Store,row:MarketSnapshot){
 safeDb(db);
 const odds=finite(row.american_odds,'AMERICAN_ODDS');
 if(!Number.isSafeInteger(odds)||odds===0||Math.abs(odds)<100||Math.abs(odds)>100000)throw Error('INVALID_AMERICAN_ODDS');
 const point=row.point==null?null:finite(row.point,'POINT');
 const raw=JSON.stringify(row.raw??{});
 if(!raw||new TextEncoder().encode(raw).length>32768)throw Error('INVALID_RAW_SIZE');
 await db.prepare('INSERT INTO market_snapshots (event_id,provider,bookmaker,market_key,selection_key,american_odds,point,pulled_at,raw) VALUES (?,?,?,?,?,?,?,?,?)')
 .bind(required(row.event_id,'EVENT_ID'),required(row.provider,'PROVIDER'),required(row.bookmaker,'BOOKMAKER'),required(row.market_key,'MARKET_KEY'),required(row.selection_key,'SELECTION_KEY'),odds,point,iso(row.pulled_at),raw).run();
}
export async function getRecentMarketSnapshots(db:D1Store,eventId:string,limit=50){
 safeDb(db);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('INVALID_LIMIT');
 const results=await db.prepare('SELECT id,event_id,provider,bookmaker,market_key,selection_key,american_odds,point,pulled_at,raw FROM market_snapshots WHERE event_id=? ORDER BY pulled_at DESC,id DESC LIMIT ?').bind(required(eventId,'EVENT_ID'),limit).all<Record<string,unknown>>();
 return results.results.map(row=>({...row,raw:typeof row.raw==='string'?JSON.parse(row.raw):row.raw}));
}
