import type {RawIntelligenceObservation} from './warehouse';
import {appendIntelligenceObservations} from './warehouse';

type RecordLike=Record<string,unknown>;
const record=(value:unknown):RecordLike|null=>
 value&&typeof value==='object'&&!Array.isArray(value)?value as RecordLike:null;
const items=(payload:unknown):unknown[]=>{
 if(Array.isArray(payload))return payload;
 const data=record(payload);
 for(const key of ['data','results','items','rows'])if(Array.isArray(data?.[key]))return data[key] as unknown[];
 return [];
};
const string=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;

/** No ingestion timestamp substitutions for missing upstream event timestamps. */
export function injuryObservations(payload:unknown,providerId:string,now=Date.now()):RawIntelligenceObservation[]{
 const output:RawIntelligenceObservation[]=[];
 for(const item of items(payload).slice(0,100)){
  const row=record(item);
  if(!row)continue;
  const reportTime=string(row.reportedAt)??string(row.updatedAt)??string(row.observedAt);
  const athleteId=string(row.playerId)??string(row.athleteId);
  const eventId=string(row.eventId)??(athleteId?`athlete:${athleteId}`:null);
  if(!reportTime||!eventId)continue;
  const timestamp=Date.parse(reportTime);
  if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>86400000)continue;
  output.push({provider:providerId,upstreamId:providerId,eventId,
   observedAt:timestamp,kind:'injury',
   value:{athleteId,teamId:string(row.teamId),status:string(row.status),
    reportedAt:reportTime,providerId}});
 }
 return output;
}
export async function mirrorInjuryReports(
 payload:unknown,providerId:string|undefined,degraded:boolean
){
 if(process.env.INTELLIGENCE_WAREHOUSE_INJURY_MIRROR!=='true')return {status:'DISABLED'};
 if(!providerId||degraded)return {status:'UNVERIFIED'};
 const observations=injuryObservations(payload,providerId);
 if(!observations.length)return {status:'NO_SOURCE_DATED_REPORTS'};
 const report=await appendIntelligenceObservations(observations);
 return {status:'RECORDED',...report};
}
