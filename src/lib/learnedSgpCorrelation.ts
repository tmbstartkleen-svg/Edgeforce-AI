import {db} from './db';

export type LearnedSgpProfile={
 sport:string;
 marketA:string;
 marketB:string;
 sampleSize:number;
 jointHits:number;
 aHits:number;
 bHits:number;
 phi:number;
 lift:number;
 learnedRho:number;
 confidence:number;
};

export type LearnedSgpMap=Record<string,LearnedSgpProfile>;

const norm=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
export function sgpMarketSignature(market:string,selection=''){
 const text=norm(`${market} ${selection}`);
 const direction=text.includes(' over ')||text.startsWith('over ')?'over':
  text.includes(' under ')||text.startsWith('under ')?'under':
  text.includes('moneyline')||text.includes(' moneyline')?'moneyline':
  text.includes('spread')||text.includes('run line')||text.includes('puck line')?'spread':
  text.includes('total')?'total':'neutral';
 return `${norm(market)}|${direction}`;
}
const key=(sport:string,a:string,b:string)=>{
 const [x,y]=[norm(a),norm(b)].sort();
 return [norm(sport),x,y].join('|');
};
const clamp=(n:number,min=-.75,max=.75)=>Math.max(min,Math.min(max,n));

export function learnedSgpKey(sport:string,a:string,b:string){return key(sport,a,b)}

export async function loadLearnedSgpCorrelations():Promise<LearnedSgpMap>{
 const sql=db();
 if(!sql)return {};
 try{
  const rows=await sql`
   select sport,market_a as "marketA",market_b as "marketB",sample_size as "sampleSize",
    joint_hits as "jointHits",a_hits as "aHits",b_hits as "bHits",
    phi::float,lift::float,learned_rho::float as "learnedRho",confidence::float
   from sgp_correlation_profiles
   order by sample_size desc,confidence desc
  `;
  const out:LearnedSgpMap={};
  for(const row of rows as any[]){
   const profile:LearnedSgpProfile={
    sport:String(row.sport),marketA:String(row.marketA),marketB:String(row.marketB),
    sampleSize:Number(row.sampleSize||0),jointHits:Number(row.jointHits||0),
    aHits:Number(row.aHits||0),bHits:Number(row.bHits||0),
    phi:Number(row.phi||0),lift:Number(row.lift||0),
    learnedRho:Number(row.learnedRho||0),confidence:Number(row.confidence||0)
   };
   out[key(profile.sport,profile.marketA,profile.marketB)]=profile;
  }
  return out;
 }catch{
  return {};
 }
}

export function learnedSgpProfile(map:LearnedSgpMap|undefined,sport:string,a:string,b:string){
 if(!map)return undefined;
 return map[key(sport,a,b)];
}

type PairRow={sport:string;marketA:string;marketB:string;selectionA:string;selectionB:string;aResult:string;bResult:string};

export async function rebuildLearnedSgpCorrelations(){
 const sql=db();
 const minimumSample=Math.max(10,Number(process.env.SGP_CORRELATION_MIN_SAMPLE||20));
 const shrinkageSamples=Math.max(10,Number(process.env.SGP_CORRELATION_SHRINKAGE_SAMPLES||50));
 if(!sql)return {ok:true,mode:'dry-run' as const,pairRows:0,profilesWritten:0,activeProfiles:0,minimumSample,shrinkageSamples};

 const raw=await sql`
  select coalesce(a.sport,b.sport,'Unknown') as sport,
   a.market_type as "marketA",b.market_type as "marketB",
   a.selection as "selectionA",b.selection as "selectionB",
   a.result as "aResult",b.result as "bResult"
  from bet_legs a
  join bet_legs b
   on a.bet_slip_id=b.bet_slip_id
   and a.event_id=b.event_id
   and a.ordinal<b.ordinal
  where a.event_id is not null
   and a.result in ('win','loss')
   and b.result in ('win','loss')
  order by coalesce(a.settled_at,b.settled_at) desc nulls last
  limit 20000
 `;

 const groups=new Map<string,{sport:string;marketA:string;marketB:string;n11:number;n10:number;n01:number;n00:number}>();
 for(const row of raw as unknown as PairRow[]){
  let marketA=sgpMarketSignature(String(row.marketA||'Unknown'),String(row.selectionA||''));
  let marketB=sgpMarketSignature(String(row.marketB||'Unknown'),String(row.selectionB||''));
  let aWin=row.aResult==='win';
  let bWin=row.bResult==='win';
  if(marketA>marketB){
   [marketA,marketB]=[marketB,marketA];
   [aWin,bWin]=[bWin,aWin];
  }
  const k=key(String(row.sport||'Unknown'),marketA,marketB);
  const g=groups.get(k)||{sport:String(row.sport||'Unknown'),marketA,marketB,n11:0,n10:0,n01:0,n00:0};
  if(aWin&&bWin)g.n11++;
  else if(aWin&&!bWin)g.n10++;
  else if(!aWin&&bWin)g.n01++;
  else g.n00++;
  groups.set(k,g);
 }

 const modelVersion=process.env.MODEL_VERSION||'edgeforce-v35';
 const [run]=await sql`
  insert into sgp_correlation_runs(model_version,pair_rows,minimum_sample,shrinkage_samples)
  values(${modelVersion},${raw.length},${minimumSample},${shrinkageSamples})
  returning id
 `;

 let profilesWritten=0,activeProfiles=0;
 for(const g of groups.values()){
  const n=g.n11+g.n10+g.n01+g.n00;
  const aHits=g.n11+g.n10;
  const bHits=g.n11+g.n01;
  const denom=Math.sqrt((g.n11+g.n10)*(g.n01+g.n00)*(g.n11+g.n01)*(g.n10+g.n00));
  const phi=denom>0?(g.n11*g.n00-g.n10*g.n01)/denom:0;
  const pA=n?aHits/n:0;
  const pB=n?bHits/n:0;
  const pJoint=n?g.n11/n:0;
  const lift=pA>0&&pB>0?pJoint/(pA*pB)-1:0;
  const confidence=n/(n+shrinkageSamples);
  const learnedRho=n>=minimumSample?clamp(phi*confidence,-.55,.55):0;
  if(n>=minimumSample)activeProfiles++;

  await sql`
   insert into sgp_correlation_profiles(
    sport,market_a,market_b,sample_size,joint_hits,a_hits,b_hits,phi,lift,
    learned_rho,confidence,minimum_sample,model_version,updated_at
   ) values(
    ${g.sport},${g.marketA},${g.marketB},${n},${g.n11},${aHits},${bHits},
    ${phi},${lift},${learnedRho},${confidence},${minimumSample},${modelVersion},now()
   )
   on conflict (sport,market_a,market_b) do update set
    sample_size=excluded.sample_size,joint_hits=excluded.joint_hits,a_hits=excluded.a_hits,b_hits=excluded.b_hits,
    phi=excluded.phi,lift=excluded.lift,learned_rho=excluded.learned_rho,confidence=excluded.confidence,
    minimum_sample=excluded.minimum_sample,model_version=excluded.model_version,updated_at=now()
  `;
  profilesWritten++;
 }

 await sql`
  update sgp_correlation_runs
  set profiles_written=${profilesWritten},active_profiles=${activeProfiles},completed_at=now()
  where id=${run.id}
 `;

 return {ok:true,mode:'database' as const,runId:Number(run.id),pairRows:raw.length,profilesWritten,activeProfiles,minimumSample,shrinkageSamples};
}
