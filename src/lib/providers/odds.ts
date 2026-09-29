import {fetchWithFailover} from './failover';
import {normalizeOddsPayload} from './normalizeOdds';
import type {Market} from '../types';

export type OddsIngestionResult={
 mode:'live'|'unconfigured'|'failed';
 providerId?:string;
 providerName?:string;
 markets:Market[];
 rawCount:number;
 warnings:string[];
 attempts:Array<{providerId:string;ok:boolean;latencyMs:number;error?:string;status?:number}>;
 error?:string;
};

export async function fetchNormalizedOdds():Promise<OddsIngestionResult>{
 const result=await fetchWithFailover('ODDS');
 if(!result.ok){
  return {
   mode:result.attempts.length?'failed':'unconfigured',
   markets:[],rawCount:0,warnings:[],attempts:result.attempts,error:result.error
  };
 }
 const normalized=normalizeOddsPayload(result.data);
 return {
  mode:'live',
  providerId:result.providerId,
  providerName:result.providerName,
  markets:normalized.markets,
  rawCount:normalized.rawCount,
  warnings:normalized.warnings,
  attempts:result.attempts
 };
}
