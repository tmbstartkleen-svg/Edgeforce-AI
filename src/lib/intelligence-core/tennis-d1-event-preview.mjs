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
