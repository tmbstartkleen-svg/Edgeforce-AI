import {createHash} from 'node:crypto';

/** D1-native archive adapter; called only after independent source approval. */
export async function appendSportsMarketSnapshot(db,quote,{sourceApproved=false,now=Date.now()}={}){
 if(!db?.prepare)throw Error('D1_NOT_BOUND');
 if(sourceApproved!==true)throw Error('SOURCE_APPROVAL_REQUIRED');
 if(!quote||typeof quote!=='object')throw Error('INVALID_QUOTE');
 const required=['sourceId','upstreamId','sourceEventId','sport','league','home','away','startTime','market','selection','bookmaker'];
 for(const key of required){
  if(typeof quote[key]!=='string'||quote[key].length<1||quote[key].length>160)throw Error('INVALID_'+key.toUpperCase());
 }
 if(!Number.isInteger(quote.odds)||Math.abs(quote.odds)>100000)throw Error('INVALID_AMERICAN_ODDS');
 if(!Number.isFinite(quote.observedAt)||quote.observedAt>now+30000||now-quote.observedAt>86400000)throw Error('STALE_OR_INVALID_SOURCE_TIMESTAMP');
 // Caller approval is insufficient: D1's active source registry is authoritative.
 const registered=await db.prepare('SELECT upstream_id FROM intelligence_sources WHERE source_id=? AND enabled=1')
  .bind(quote.sourceId).first();
 if(!registered||registered.upstream_id!==quote.upstreamId)throw Error('SOURCE_NOT_REGISTERED_IN_D1');
 const raw=JSON.stringify(quote);
 if(new TextEncoder().encode(raw).length>32768)throw Error('PAYLOAD_TOO_LARGE');
 const sha256=createHash('sha256').update(raw).digest('hex');
 const result=await db.prepare(`INSERT OR IGNORE INTO sports_market_snapshots
 (source_id,upstream_id,source_event_id,sport,league,home_team,away_team,start_time,
 market_key,selection_key,bookmaker,american_odds,source_observed_at,payload_sha256,raw_json)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
 quote.sourceId,quote.upstreamId,quote.sourceEventId,quote.sport,quote.league,
 quote.home,quote.away,quote.startTime,quote.market,quote.selection,quote.bookmaker,
 quote.odds,new Date(quote.observedAt).toISOString(),sha256,raw
 ).run();
 return {written:Number(result.meta?.changes??0),payloadSha256:sha256,legacyNeonModified:false};
}
export async function recentSportsMarketSnapshots(db,{limit=50}={}){
 if(!db?.prepare)throw Error('D1_NOT_BOUND');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('INVALID_READ_LIMIT');
 const rows=await db.prepare(`SELECT source_id,upstream_id,source_event_id,sport,league,
 home_team,away_team,start_time,market_key,selection_key,bookmaker,american_odds,
 source_observed_at,ingested_at,payload_sha256
 FROM sports_market_snapshots ORDER BY source_observed_at DESC LIMIT ?`).bind(limit).all();
 return rows.results;
}
