import {buildSkillRatings,type SkillRatingRow} from './skillRatings';
import {loadExecutionFeedback} from './executionFeedback';

export type AllocationLane={
 id:string;
 domain:'SPORTS'|'MARKETS';
 dimension:SkillRatingRow['dimension'];
 key:string;
 sampleSize:number;
 evidence:SkillRatingRow['evidence'];
 rating:number;
 confidence:number;
 allocationWeight:number;
 maxWeight:number;
 state:'PRIMARY'|'ACTIVE'|'WATCH'|'LIMITED'|'HOLD';
 reason:string;
};

export type DailyEdgePlan={
 generatedAt:string;
 sportsWeight:number;
 marketsWeight:number;
 lanes:AllocationLane[];
 safeguards:{
  minLeaderSamples:number;
  maxSingleLaneWeight:number;
  maxDomainWeight:number;
  insufficientWeightCap:number;
 };
 notes:string[];
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function evidenceMultiplier(e:SkillRatingRow['evidence']){
 if(e==='VERIFIED')return 1;
 if(e==='QUALIFIED')return .86;
 if(e==='PROVISIONAL')return .58;
 return .22;
}

function dimensionMultiplier(d:SkillRatingRow['dimension']){
 if(d==='STRATEGY')return 1;
 if(d==='CATEGORY')return .94;
 if(d==='MODEL')return .90;
 if(d==='VENUE')return .80;
 return .70;
}

function maxWeight(row:SkillRatingRow){
 if(row.evidence==='VERIFIED')return .22;
 if(row.evidence==='QUALIFIED')return .16;
 if(row.evidence==='PROVISIONAL')return .09;
 return .035;
}

function laneState(weight:number,row:SkillRatingRow):AllocationLane['state']{
 if(row.sampleSize<25)return 'HOLD';
 if(weight>=.14)return 'PRIMARY';
 if(weight>=.075)return 'ACTIVE';
 if(weight>=.035)return 'WATCH';
 return 'LIMITED';
}

export async function buildDailyEdgePlan():Promise<DailyEdgePlan>{
 const [skill,execution]=await Promise.all([buildSkillRatings(),loadExecutionFeedback()]);
 const candidates=skill.ratings
  .filter(x=>['STRATEGY','CATEGORY','MODEL'].includes(x.dimension))
  .filter(x=>x.sampleSize>0)
  .map(row=>{
   const quality=clamp((row.rating-42)/35);
   const categoryKey=row.domain+'|'+row.key.toLowerCase();
   const executionMultiplier=row.dimension==='CATEGORY'
    ?(execution.categoryMultipliers.get(categoryKey)??execution.domainMultipliers.get(row.domain)??1)
    :(execution.domainMultipliers.get(row.domain)??1);
   const raw=quality*row.confidence*evidenceMultiplier(row.evidence)*dimensionMultiplier(row.dimension)*executionMultiplier;
   return {row,raw};
  })
  .sort((a,b)=>b.raw-a.raw||b.row.sampleSize-a.row.sampleSize)
  .slice(0,40);

 const totalRaw=candidates.reduce((s,x)=>s+x.raw,0)||1;
 let normalized=candidates.map(({row,raw})=>({row,weight:Math.min(maxWeight(row),raw/totalRaw)}));

 for(let pass=0;pass<3;pass++){
  const sum=normalized.reduce((s,x)=>s+x.weight,0)||1;
  const remaining=Math.max(0,1-sum);
  const headroom=normalized.reduce((s,x)=>s+Math.max(0,maxWeight(x.row)-x.weight),0);
  if(remaining<=1e-9||headroom<=1e-9)break;
  normalized=normalized.map(x=>{
   const room=Math.max(0,maxWeight(x.row)-x.weight);
   return {...x,weight:x.weight+remaining*(room/headroom)};
  });
 }

 const domainWeight=(domain:'SPORTS'|'MARKETS')=>normalized.filter(x=>x.row.domain===domain).reduce((s,x)=>s+x.weight,0);
 for(const domain of ['SPORTS','MARKETS'] as const){
  const current=domainWeight(domain);
  if(current>.75){
   const factor=.75/current;
   normalized=normalized.map(x=>x.row.domain===domain?{...x,weight:x.weight*factor}:x);
  }
 }

 const lanes:AllocationLane[]=normalized
  .filter(x=>x.weight>=.01)
  .sort((a,b)=>b.weight-a.weight)
  .map(({row,weight},i)=>{
   const allocationWeight=Math.round(weight*1000)/1000;
   const state=laneState(allocationWeight,row);
   let reason='limited allocation because confidence/evidence is weaker';
   if(state==='PRIMARY')reason='top validated lane; rating '+row.rating.toFixed(1)+' with '+row.sampleSize+' settled samples';
   else if(state==='ACTIVE')reason='validated enough for normal analytical emphasis; '+row.evidence.toLowerCase()+' evidence';
   else if(state==='WATCH')reason='useful secondary lane but keep exposure constrained';
   else if(state==='HOLD')reason='hold until more settled history exists';
   return {
    id:[row.domain,row.dimension,row.key,i].join('|'),
    domain:row.domain,
    dimension:row.dimension,
    key:row.key,
    sampleSize:row.sampleSize,
    evidence:row.evidence,
    rating:row.rating,
    confidence:row.confidence,
    allocationWeight,
    maxWeight:maxWeight(row),
    state,
    reason
   };
  });

 const sportsWeight=Math.round(lanes.filter(x=>x.domain==='SPORTS').reduce((s,x)=>s+x.allocationWeight,0)*1000)/1000;
 const marketsWeight=Math.round(lanes.filter(x=>x.domain==='MARKETS').reduce((s,x)=>s+x.allocationWeight,0)*1000)/1000;

 return {
  generatedAt:new Date().toISOString(),
  sportsWeight,
  marketsWeight,
  lanes,
  safeguards:{
   minLeaderSamples:25,
   maxSingleLaneWeight:.22,
   maxDomainWeight:.75,
   insufficientWeightCap:.035
  },
  notes:[
   'Allocation is an analytical weighting plan, not an instruction to wager or invest.',
   'Unallocated weight is intentional when evidence is weak; EdgeForce can prefer HOLD over forcing activity.',
   'Early Cash-Out, Live Comeback, SGP and other strategies can earn more weight only after enough settled strategy-tagged outcomes accumulate.',
   'V103 validation and champion/challenger rules remain authoritative; routing cannot promote a model on its own.',
   'V111 applies only a bounded execution-quality multiplier from 30-day price-capture history; outcome skill remains primary.'
  ]
 };
}
