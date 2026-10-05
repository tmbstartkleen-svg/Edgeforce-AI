import {db} from './db';
import type {BestPriceRow} from './bestPrice';

export type CaptureGrade='ELITE'|'POSITIVE'|'FLAT'|'NEGATIVE'|'INSUFFICIENT';
export type PriceCaptureRow={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;
 firstObservedAt:string|null;latestObservedAt:string|null;firstBestProbability:number|null;latestBestProbability:number|null;
 capturedValuePoints:number|null;capturedValuePct:number|null;observations:number;grade:CaptureGrade;benchmarkConfidence:number;reason:string;
};
export type VenueBenchmark={venue:string;domain:'SPORTS'|'MARKETS';samples:number;positiveSamples:number;positiveRate:number;averageCapturePoints:number;medianCapturePoints:number;confidence:number;rankScore:number};

const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const median=(xs:number[])=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
function grade(value:number|null,n:number):CaptureGrade{if(value===null||n<2)return 'INSUFFICIENT';if(value>=2)return 'ELITE';if(value>=.5)return 'POSITIVE';if(value>-.5)return 'FLAT';return 'NEGATIVE';}

export async function buildPriceCaptureReport(currentRows:BestPriceRow[]){
 const sql=db();
 if(!sql)return {configured:false,generatedAt:new Date().toISOString(),rows:currentRows.map(x=>({id:x.id,domain:x.domain,category:x.category,venue:x.bestVenue,title:x.title,firstObservedAt:null,latestObservedAt:null,firstBestProbability:null,latestBestProbability:null,capturedValuePoints:null,capturedValuePct:null,observations:0,grade:'INSUFFICIENT' as const,benchmarkConfidence:0,reason:'Database history unavailable.'})),venueBenchmarks:[] as VenueBenchmark[],summary:{elite:0,positive:0,flat:0,negative:0,insufficient:currentRows.length}};
 const ids=currentRows.map(x=>x.id);
 const history=ids.length?await sql`
  select opportunity_id,observed_at,best_venue,best_probability::float8,domain,category
  from best_price_snapshots
  where opportunity_id = any(${ids})
    and observed_at >= now() - interval '7 days'
  order by opportunity_id,observed_at asc
 `:[];
 const grouped=new Map<string,any[]>();
 for(const row of history as any[]){const id=String(row.opportunity_id);grouped.set(id,[...(grouped.get(id)||[]),row]);}
 const rows:PriceCaptureRow[]=currentRows.map(current=>{
  const h=grouped.get(current.id)||[];
  if(h.length<2)return {id:current.id,domain:current.domain,category:current.category,venue:current.bestVenue,title:current.title,firstObservedAt:h[0]?.observed_at?String(h[0].observed_at):null,latestObservedAt:h.at(-1)?.observed_at?String(h.at(-1).observed_at):null,firstBestProbability:h[0]?Number(h[0].best_probability):null,latestBestProbability:h.at(-1)?Number(h.at(-1).best_probability):null,capturedValuePoints:null,capturedValuePct:null,observations:h.length,grade:'INSUFFICIENT',benchmarkConfidence:clamp(h.length/12),reason:'More historical price observations are required before benchmarking price capture.'};
  const first=Number(h[0].best_probability);
  const latest=Number(h[h.length-1].best_probability);
  const capturedValuePoints=(latest-first)*100;
  const capturedValuePct=first>0?((latest-first)/first)*100:null;
  const g=grade(capturedValuePoints,h.length);
  return {id:current.id,domain:current.domain,category:current.category,venue:current.bestVenue,title:current.title,firstObservedAt:String(h[0].observed_at),latestObservedAt:String(h[h.length-1].observed_at),firstBestProbability:first,latestBestProbability:latest,capturedValuePoints,capturedValuePct,observations:h.length,grade:g,benchmarkConfidence:clamp(h.length/20),reason:g==='ELITE'?'Earlier EdgeForce best-price observation materially beat the later market price.':g==='POSITIVE'?'Earlier EdgeForce best-price observation retained positive value versus the later market.':g==='FLAT'?'Price capture was roughly flat versus the later market.':'Later market pricing improved versus the earlier identified price.'};
 });
 const eligible=rows.filter(x=>x.capturedValuePoints!==null);
 const byVenue=new Map<string,PriceCaptureRow[]>();
 for(const row of eligible){const key=row.domain+'|'+row.venue;byVenue.set(key,[...(byVenue.get(key)||[]),row]);}
 const venueBenchmarks:VenueBenchmark[]=[...byVenue.entries()].map(([key,group])=>{
  const [domain,venue]=key.split('|') as ['SPORTS'|'MARKETS',string];
  const values=group.map(x=>x.capturedValuePoints as number);
  const positiveSamples=values.filter(x=>x>0).length;
  const samples=values.length;
  const positiveRate=samples?positiveSamples/samples:0;
  const averageCapturePoints=mean(values);
  const medianCapturePoints=median(values);
  const confidence=clamp(samples/50);
  const rankScore=(averageCapturePoints*.45+medianCapturePoints*.25+positiveRate*4*.30)*confidence;
  return {venue,domain,samples,positiveSamples,positiveRate,averageCapturePoints,medianCapturePoints,confidence,rankScore};
 }).sort((a,b)=>b.rankScore-a.rankScore||b.samples-a.samples);
 return {configured:true,generatedAt:new Date().toISOString(),rows:rows.sort((a,b)=>(b.capturedValuePoints??-999)-(a.capturedValuePoints??-999)),venueBenchmarks,summary:{elite:rows.filter(x=>x.grade==='ELITE').length,positive:rows.filter(x=>x.grade==='POSITIVE').length,flat:rows.filter(x=>x.grade==='FLAT').length,negative:rows.filter(x=>x.grade==='NEGATIVE').length,insufficient:rows.filter(x=>x.grade==='INSUFFICIENT').length}};
}

export async function persistPriceCapture(rows:PriceCaptureRow[]){
 const sql=db();
 if(!sql||!rows.length)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from price_capture_benchmarks`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<15*60000)return {persisted:false};
 for(const x of rows){
  await sql`
   insert into price_capture_benchmarks(
    observed_at,opportunity_id,domain,category,venue,first_best_probability,latest_best_probability,
    captured_value_points,captured_value_pct,observations,grade,benchmark_confidence,metadata
   ) values(
    now(),${x.id},${x.domain},${x.category},${x.venue},${x.firstBestProbability},${x.latestBestProbability},
    ${x.capturedValuePoints},${x.capturedValuePct},${x.observations},${x.grade},${x.benchmarkConfidence},
    ${sql.json({reason:x.reason} as any)}
   )
  `;
 }
 return {persisted:true};
}
