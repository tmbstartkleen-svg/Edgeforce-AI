/** Source-scoped tennis event observations, not licensed sportsbook markets.
 * Only normalize supplied provider records with explicit source and timestamps.
 */
export function previewTennisD1Events(records,{source,observedAt}={}){
 if(typeof source!=='string'||!/^[-a-zA-Z0-9_.:]{3,80}$/.test(source)||
  typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt))||!Array.isArray(records))
  return {type:'events',items:[],rejected:0,reason:'INVALID_SOURCE',previewOnly:true,
   sportsbookOddsAvailable:false,draftKingsInventoryCertified:false};
 const seen=new Set(),items=[];let rejected=0;
 for(const record of records.slice(0,100)){
  if(!record||typeof record.id!=='string'||!/^[-a-zA-Z0-9_.:]{1,120}$/.test(record.id)||
   typeof record.startTime!=='string'||!Number.isFinite(Date.parse(record.startTime))||
   typeof record.tournament!=='string'||!record.tournament.trim()){rejected++;continue;}
  const id=source+':tennis:'+record.id;
  if(seen.has(id)){rejected++;continue;}seen.add(id);
  items.push({id,provider_event_id:id,sport:'tennis',league:record.tournament.slice(0,200),
   start_time:new Date(record.startTime).toISOString(),source,
   observed_at:new Date(observedAt).toISOString(),status:'unverified-provider-fixture'});
 }
 return {type:'events',items:items.slice(0,25),totalObserved:items.length,rejected,
  truncated:items.length>25,previewOnly:true,sourceApprovedForMarketRanking:false,
  sportsbookOddsAvailable:false,draftKingsInventoryCertified:false};
}

/** Partition all normalized source events into bounded, non-writing D1 pilot previews.
 * Reject malformed source records, preserve source-scoped ids, and signal truncation.
 */
export function previewTennisD1Batches(records,context={}){
 const result=previewTennisD1Events(records,context);
 if(result.reason)return {...result,batches:[],complete:false};
 const batches=[];
 // The underlying normalizer inspects at most 100 events per call.
 // Slice into 25-record groups to preserve all supplied records.
 const seen=new Set();let rejected=0;
 for(let offset=0;offset<records.length;offset+=25){
  const part=previewTennisD1Events(records.slice(offset,offset+25),context);
  rejected+=part.rejected;
  const items=part.items.filter(item=>{if(seen.has(item.id)){rejected++;return false;}seen.add(item.id);return true;});
  if(items.length)batches.push({type:'events',items,previewOnly:true,
   sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false,draftKingsInventoryCertified:false});
 }
 return {previewOnly:true,sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false,
  draftKingsInventoryCertified:false,batches,totalObserved:seen.size,rejected,
  complete:true,ingestionEnabled:false};
}
