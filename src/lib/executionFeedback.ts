import {db} from './db';

export type ExecutionFeedbackRow={
 domain:'SPORTS'|'MARKETS';
 dimension:'CATEGORY'|'VENUE';
 key:string;
 samples:number;
 positiveRate:number;
 averageCapturePoints:number;
 medianCapturePoints:number;
 confidence:number;
 multiplier:number;
 state:'BOOST'|'NEUTRAL'|'REDUCE'|'INSUFFICIENT';
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const median=(xs:number[])=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};

function buildRow(domain:'SPORTS'|'MARKETS',dimension:'CATEGORY'|'VENUE',key:string,values:number[]):ExecutionFeedbackRow{
 const samples=values.length;
 const positiveRate=samples?values.filter(x=>x>0).length/samples:0;
 const averageCapturePoints=mean(values);
 const medianCapturePoints=median(values);
 const confidence=clamp(samples/60);
 let multiplier=1;
 let state:ExecutionFeedbackRow['state']='INSUFFICIENT';
 if(samples>=12){
  const signal=averageCapturePoints*.45+medianCapturePoints*.30+(positiveRate-.5)*3*.25;
  const bounded=clamp(.5+signal/6,0,1);
  multiplier=.90+bounded*.20;
  state=multiplier>=1.04?'BOOST':multiplier<=.96?'REDUCE':'NEUTRAL';
 }else{
  multiplier=.98+confidence*.02;
 }
 return {domain,dimension,key,samples,positiveRate,averageCapturePoints,medianCapturePoints,confidence,multiplier,state};
}

export async function loadExecutionFeedback(){
 const sql=db();
 if(!sql)return {configured:false,rows:[] as ExecutionFeedbackRow[],categoryMultipliers:new Map<string,number>(),domainMultipliers:new Map<string,number>()};
 const history=await sql`
  select domain,category,venue,captured_value_points::float8
  from price_capture_benchmarks
  where observed_at >= now() - interval '30 days'
    and captured_value_points is not null
  order by observed_at desc
  limit 20000
 `;
 const categoryGroups=new Map<string,number[]>();
 const venueGroups=new Map<string,number[]>();
 const domainGroups=new Map<string,number[]>();
 for(const x of history as any[]){
  const domain=String(x.domain)==='MARKETS'?'MARKETS':'SPORTS';
  const category=String(x.category||'OTHER');
  const venue=String(x.venue||'UNSPECIFIED');
  const value=Number(x.captured_value_points);
  if(!Number.isFinite(value))continue;
  const cKey=domain+'|'+category;
  const vKey=domain+'|'+venue;
  categoryGroups.set(cKey,[...(categoryGroups.get(cKey)||[]),value]);
  venueGroups.set(vKey,[...(venueGroups.get(vKey)||[]),value]);
  domainGroups.set(domain,[...(domainGroups.get(domain)||[]),value]);
 }
 const rows:ExecutionFeedbackRow[]=[];
 for(const [key,values] of categoryGroups){
  const [domain,category]=key.split('|') as ['SPORTS'|'MARKETS',string];
  rows.push(buildRow(domain,'CATEGORY',category,values));
 }
 for(const [key,values] of venueGroups){
  const [domain,venue]=key.split('|') as ['SPORTS'|'MARKETS',string];
  rows.push(buildRow(domain,'VENUE',venue,values));
 }
 rows.sort((a,b)=>b.multiplier-a.multiplier||b.samples-a.samples);
 const categoryMultipliers=new Map<string,number>();
 for(const row of rows.filter(x=>x.dimension==='CATEGORY'))categoryMultipliers.set(row.domain+'|'+row.key.toLowerCase(),row.multiplier);
 const domainMultipliers=new Map<string,number>();
 for(const [domain,values] of domainGroups){
  const row=buildRow(domain as 'SPORTS'|'MARKETS','CATEGORY','__DOMAIN__',values);
  domainMultipliers.set(domain,row.multiplier);
 }
 return {configured:true,rows,categoryMultipliers,domainMultipliers};
}