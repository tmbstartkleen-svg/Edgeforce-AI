import type {ProviderCapability} from '../providerRegistry';

export type PayloadQuality={
 ok:boolean;
 rowCount:number;
 payloadAgeMin?:number;
 freshnessScore:number;
 completenessScore:number;
 qualityScore:number;
 grade:'TRUSTED'|'USABLE'|'CAUTION'|'REJECT';
 reasons:string[];
 newestTimestamp?:string;
};

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));

function rows(payload:unknown):unknown[]{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const key of ['markets','events','results','data','rows','contracts','injuries','weather','stats']){
  const value=root[key];
  if(Array.isArray(value))return value;
 }
 return Object.keys(root).length?[root]:[];
}

function timestampCandidates(value:unknown,depth=0):number[]{
 if(depth>2||value==null)return [];
 if(Array.isArray(value))return value.slice(0,25).flatMap(x=>timestampCandidates(x,depth+1));
 if(typeof value!=='object')return [];
 const record=value as Record<string,unknown>;
 const out:number[]=[];
 for(const key of ['pulledAt','pulled_at','updatedAt','updated_at','timestamp','asOf','as_of','lastUpdated','last_updated','generatedAt','generated_at']){
  const raw=record[key];
  if(typeof raw==='string'||typeof raw==='number'){
   const normalized=typeof raw==='number'&&raw>0&&raw<1e12?raw*1000:raw;
   const ms=new Date(normalized).getTime();
   if(Number.isFinite(ms))out.push(ms);
  }
 }
 for(const key of ['meta','metadata','source','provider','markets','events','results','data','rows','contracts','injuries','weather','stats']){
  if(record[key])out.push(...timestampCandidates(record[key],depth+1));
 }
 return out;
}

function maxAgeDefault(capability:ProviderCapability){
 switch(capability){
  case 'ODDS': return 20;
  case 'WEATHER': return 90;
  case 'INJURIES': return 180;
  case 'STATS': return 360;
  case 'RESULTS': return 1440;
  case 'PREDICTION_MARKETS': return 30;
 }
}

function requiresRows(capability:ProviderCapability){
 return capability==='ODDS'||capability==='STATS'||capability==='PREDICTION_MARKETS';
}

export function inspectProviderPayload(payload:unknown,capability:ProviderCapability,maxAgeMin=maxAgeDefault(capability)):PayloadQuality{
 const list=rows(payload);
 const rowCount=list.length;
 const timestamps=timestampCandidates(payload);
 const now=Date.now();
 // Do not let a badly clock-skewed source timestamp falsely certify fresh data.
 const futureSkewCount=timestamps.filter(t=>t>now+120000).length;
 const validTimestamps=timestamps.filter(t=>t<=now+120000);
 const newest=validTimestamps.length?Math.max(...validTimestamps):undefined;
 const payloadAgeMin=newest===undefined?undefined:Math.max(0,(Date.now()-newest)/60000);
 const freshnessScore=payloadAgeMin===undefined
  ?.35
  :payloadAgeMin<=maxAgeMin*.25?1
  :payloadAgeMin<=maxAgeMin?.82
  :payloadAgeMin<=maxAgeMin*2?.45
  :.08;
 const completenessScore=requiresRows(capability)?(rowCount>0?1:0):(rowCount>0?1:.8);
 const qualityScore=clamp(.68*freshnessScore+.32*completenessScore);
 const reasons:string[]=[];
 if(futureSkewCount)reasons.push(`Ignored ${futureSkewCount} future-skewed payload timestamp(s)`);
 if(requiresRows(capability)&&rowCount===0)reasons.push('Provider returned no usable rows');
 if(payloadAgeMin!==undefined&&payloadAgeMin>maxAgeMin)reasons.push(`Payload age ${payloadAgeMin.toFixed(1)}m exceeds ${maxAgeMin}m limit`);
 if(payloadAgeMin===undefined)reasons.push('Payload timestamp unavailable or invalid; freshness confidence reduced');
 if(!reasons.length)reasons.push('Payload is fresh and structurally usable');
 // Entirely future-skewed timestamps cannot provide trustworthy freshness evidence.
 const invalidClockOnly=timestamps.length>0&&validTimestamps.length===0;
 if(invalidClockOnly)reasons.push('All payload timestamps are future-skewed; freshness unverified');
 const ok=!(requiresRows(capability)&&rowCount===0)&&!invalidClockOnly&&!(payloadAgeMin!==undefined&&payloadAgeMin>maxAgeMin*2);
 const grade:PayloadQuality['grade']=!ok?'REJECT':qualityScore>=.85?'TRUSTED':qualityScore>=.68?'USABLE':'CAUTION';
 return {ok,rowCount,payloadAgeMin,freshnessScore,completenessScore,qualityScore,grade,reasons,newestTimestamp:newest?new Date(newest).toISOString():undefined};
}
