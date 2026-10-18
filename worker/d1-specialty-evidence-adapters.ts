// Strict, opt-in evidence adapters: missing fields are not invented.
import {assessIngestEvidence} from './d1-ingest-quality-gate';
export type SpecialtyKind='player-stat'|'injury'|'weather';
type Raw={sourceId:unknown;upstreamId:unknown;eventId:unknown;observedAt:unknown;kind:unknown;payload:unknown};
export function validateSpecialtyObservation(raw:Raw,now=Date.now()){
 const kinds:SpecialtyKind[]=['player-stat','injury','weather'];
 if(!kinds.includes(raw.kind as SpecialtyKind))return {ok:false,reason:'UNSUPPORTED_KIND'};
 if(typeof raw.sourceId!=='string'||typeof raw.upstreamId!=='string'||typeof raw.eventId!=='string'||!raw.payload||
   typeof raw.payload!=='object'||Array.isArray(raw.payload))return {ok:false,reason:'MISSING_PROVENANCE_OR_PAYLOAD'};
 const kind=raw.kind as SpecialtyKind,payload=raw.payload as Record<string,unknown>;
 const required=kind==='player-stat'?['athleteId','statName','statValue']:kind==='injury'?['athleteId','status']:['eventId','temperatureF'];
 const missing=required.filter(k=>payload[k]===undefined||payload[k]===null||payload[k]==='');
 if(missing.length)return {ok:false,reason:'MISSING_REQUIRED_FIELDS',missing};
 if(kind==='player-stat'&&(typeof payload.statValue!=='number'||!Number.isFinite(payload.statValue)))return {ok:false,reason:'INVALID_STAT_VALUE'};
 if(kind==='weather'&&(typeof payload.temperatureF!=='number'||!Number.isFinite(payload.temperatureF)))return {ok:false,reason:'INVALID_WEATHER_VALUE'};
 const bytes=new TextEncoder().encode(JSON.stringify(raw.payload)).length;
 const quality=assessIngestEvidence({kind,observedAt:raw.observedAt as number,collectedAt:now,
  sourceId:raw.sourceId,upstreamId:raw.upstreamId,eventId:raw.eventId,payloadBytes:bytes},now);
 if(!quality.acceptedForPilot)return {ok:false,reason:'QUALITY_REJECTED',qualityReasons:quality.reasons};
 return {ok:true,kind,sourceId:raw.sourceId,upstreamId:raw.upstreamId,eventId:raw.eventId,observedAt:raw.observedAt,payload,
  independentlyVerified:false,approvedForBetting:false};
}
