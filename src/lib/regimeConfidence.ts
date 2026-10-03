import {db} from './db';
import type {Market} from './types';

export type MarketRegime='STABLE'|'VOLATILE'|'DISLOCATED'|'THIN'|'UNKNOWN';
export type DynamicConfidenceLabel='HIGH'|'MEDIUM'|'LOW';

export type DynamicCalibrationProfile={
 sport:string;
 marketKey:string;
 sampleSize:number;
 calibrationError:number;
 brierScore:number;
 decayedScore:number;
 confidenceLabel?:string;
};

export type DynamicCalibrationMap=Record<string,DynamicCalibrationProfile>;

export type DynamicConfidenceResult={
 rawProbability:number;
 calibratedProbability:number;
 calibratedCi:[number,number];
 dynamicConfidence:number;
 uncertainty:number;
 confidenceLabel:DynamicConfidenceLabel;
 regime:MarketRegime;
 historicalShrinkage:number;
 consensusBlend:number;
 components:{
  sourceQuality:number;
  modelAgreement:number;
  simulationPrecision:number;
  consensusAgreement:number;
  distributionConfidence:number;
  historicalReliability:number;
  regimeMultiplier:number;
 };
 profile?:DynamicCalibrationProfile;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
export const calibrationProfileKey=(sport:string,marketKey:string)=>`${String(sport||'').toUpperCase()}|${String(marketKey||'').toLowerCase()}`;

function freshnessScore(sourceAgeMin:number){
 if(sourceAgeMin<=5)return 1;
 if(sourceAgeMin<=20)return .78;
 if(sourceAgeMin<=60)return .5;
 return .3;
}

function historicalReliability(profile?:DynamicCalibrationProfile){
 if(!profile||profile.sampleSize<20)return .55;
 const sample=Math.min(1,Math.log10(Math.max(10,profile.sampleSize))/3);
 const calibration=1-clamp(profile.calibrationError/.16);
 const brier=1-clamp(Math.max(0,profile.brierScore-.16)/.20);
 const decayed=clamp(profile.decayedScore||.5);
 return clamp(sample*.20+calibration*.34+brier*.26+decayed*.20,.25,1);
}

function regimeFor(m:Market,ciWidth:number):MarketRegime{
 const c=m.consensus;
 if(!c)return 'UNKNOWN';
 if(c.bookCount<2)return 'THIN';
 if(c.dispersion>=.055||c.agreement<.58)return 'DISLOCATED';
 if(c.dispersion>=.032||c.agreement<.72||ciWidth>.10)return 'VOLATILE';
 return 'STABLE';
}

function regimeMultiplier(regime:MarketRegime){
 if(regime==='STABLE')return 1;
 if(regime==='VOLATILE')return .84;
 if(regime==='DISLOCATED')return .68;
 if(regime==='THIN')return .74;
 return .80;
}

export function calibrateDynamicConfidence(args:{
 market:Market;
 rawProbability:number;
 ci:[number,number];
 modelAgreement:number;
 distributionConfidence?:number;
 profile?:DynamicCalibrationProfile;
}):DynamicConfidenceResult{
 const {market,profile}=args;
 const raw=clamp(args.rawProbability,.001,.999);
 const ciLow=clamp(args.ci[0]),ciHigh=clamp(args.ci[1]);
 const ciWidth=Math.max(0,ciHigh-ciLow);
 const regime=regimeFor(market,ciWidth);
 const rMultiplier=regimeMultiplier(regime);
 const sourceQuality=clamp((market.confidence*.72+freshnessScore(market.sourceAgeMin)*.28),.2,1);
 const modelAgreement=clamp(args.modelAgreement);
 const simulationPrecision=clamp(1-ciWidth/.22,.2,1);
 const consensusAgreement=market.consensus
  ?clamp(market.consensus.agreement*(market.consensus.bookCount>=3?1:.90),.2,1)
  :.58;
 const distributionConfidence=clamp(args.distributionConfidence??.72,.2,1);
 const historical=historicalReliability(profile);
 const base=
  sourceQuality*.20+
  modelAgreement*.20+
  simulationPrecision*.18+
  consensusAgreement*.18+
  distributionConfidence*.10+
  historical*.14;
 const dynamicConfidence=clamp(base*rMultiplier,.18,.98);
 const uncertainty=1-dynamicConfidence;

 const profileError=profile?.sampleSize&&profile.sampleSize>=20?profile.calibrationError:0;
 const profileBrier=profile?.sampleSize&&profile.sampleSize>=20?profile.brierScore:.25;
 const historicalShrinkage=clamp(profileError*1.55+Math.max(0,profileBrier-.25)*.65,0,.28);
 const historyAdjusted=.5+(raw-.5)*(1-historicalShrinkage);

 const consensusProbability=market.consensus?.consensusProbability??market.marketProb;
 const consensusBlend=clamp((1-dynamicConfidence)*.38+(regime==='DISLOCATED'?.12:regime==='THIN'?.08:0),.04,.42);
 const calibratedProbability=clamp(historyAdjusted*(1-consensusBlend)+consensusProbability*consensusBlend,.001,.999);

 const extraWidth=uncertainty*.045+(regime==='DISLOCATED'?.025:regime==='VOLATILE'?.012:0);
 const centerShift=calibratedProbability-raw;
 const calibratedCi:[number,number]=[
  clamp(ciLow+centerShift-extraWidth),
  clamp(ciHigh+centerShift+extraWidth)
 ];

 const confidenceLabel:DynamicConfidenceLabel=dynamicConfidence>=.78?'HIGH':dynamicConfidence>=.58?'MEDIUM':'LOW';
 return {
  rawProbability:raw,
  calibratedProbability,
  calibratedCi,
  dynamicConfidence,
  uncertainty,
  confidenceLabel,
  regime,
  historicalShrinkage,
  consensusBlend,
  components:{
   sourceQuality,
   modelAgreement,
   simulationPrecision,
   consensusAgreement,
   distributionConfidence,
   historicalReliability:historical,
   regimeMultiplier:rMultiplier
  },
  profile
 };
}

export async function loadDynamicCalibrationProfiles():Promise<DynamicCalibrationMap>{
 const sql=db();
 if(!sql)return {};
 try{
  const rows=await sql`
   select sport,market_key as "marketKey",sample_size as "sampleSize",
    calibration_error::float as "calibrationError",
    brier_score::float as "brierScore",
    decayed_score::float as "decayedScore",
    confidence_label as "confidenceLabel"
   from rolling_model_rankings
   where as_of >= now()-interval '120 days'
   order by as_of desc
   limit 2000
  `;
  const grouped=new Map<string,DynamicCalibrationProfile[]>();
  for(const raw of rows as any[]){
   const p:DynamicCalibrationProfile={
    sport:String(raw.sport||''),
    marketKey:String(raw.marketKey||''),
    sampleSize:Number(raw.sampleSize||0),
    calibrationError:Number(raw.calibrationError||0),
    brierScore:Number(raw.brierScore||.25),
    decayedScore:Number(raw.decayedScore||.5),
    confidenceLabel:raw.confidenceLabel?String(raw.confidenceLabel):undefined
   };
   const key=calibrationProfileKey(p.sport,p.marketKey);
   const list=grouped.get(key)||[];
   if(list.length<8)list.push(p);
   grouped.set(key,list);
  }
  const out:DynamicCalibrationMap={};
  for(const [key,list] of grouped){
   const weight=list.reduce((s,x)=>s+Math.max(1,x.sampleSize),0);
   out[key]={
    sport:list[0]?.sport||'',
    marketKey:list[0]?.marketKey||'',
    sampleSize:list.reduce((s,x)=>s+x.sampleSize,0),
    calibrationError:list.reduce((s,x)=>s+x.calibrationError*Math.max(1,x.sampleSize),0)/Math.max(1,weight),
    brierScore:list.reduce((s,x)=>s+x.brierScore*Math.max(1,x.sampleSize),0)/Math.max(1,weight),
    decayedScore:list.reduce((s,x)=>s+x.decayedScore*Math.max(1,x.sampleSize),0)/Math.max(1,weight),
    confidenceLabel:list.some(x=>x.confidenceLabel==='HIGH')?'HIGH':list.some(x=>x.confidenceLabel==='MEDIUM')?'MEDIUM':'LOW'
   };
  }
  return out;
 }catch{
  return {};
 }
}
