import {db} from './db';

export type SkillRatingRow={
 domain:'SPORTS'|'MARKETS';
 dimension:'MODEL'|'CATEGORY'|'VENUE'|'PROBABILITY_BAND'|'STRATEGY';
 key:string;
 sampleSize:number;
 wins:number;
 hitRate:number;
 averagePrediction:number;
 brier:number;
 logLoss:number;
 calibrationError:number;
 marketSkill:number|null;
 confidence:number;
 rating:number;
 evidence:'INSUFFICIENT'|'PROVISIONAL'|'QUALIFIED'|'VERIFIED';
};

type RawGrade={
 domain:'SPORTS'|'MARKETS';
 category:string;
 venue:string|null;
 modelVersion:string;
 strategyKey:string;
 predictedProbability:number;
 outcome:boolean;
 brier:number;
 logLoss:number;
 calibrationError:number;
 marketSkill:number|null;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const mean=(values:number[])=>values.length?values.reduce((s,x)=>s+x,0)/values.length:0;

function probabilityBand(p:number){
 if(p<.50)return '<50%';
 if(p<.55)return '50-54%';
 if(p<.60)return '55-59%';
 if(p<.65)return '60-64%';
 if(p<.70)return '65-69%';
 if(p<.75)return '70-74%';
 if(p<.80)return '75-79%';
 if(p<.85)return '80-84%';
 return '85%+';
}

function evidence(sample:number){
 if(sample>=250)return 'VERIFIED' as const;
 if(sample>=75)return 'QUALIFIED' as const;
 if(sample>=25)return 'PROVISIONAL' as const;
 return 'INSUFFICIENT' as const;
}

function sampleConfidence(sample:number){
 return clamp(1-Math.exp(-sample/80),0,.99);
}

function summarize(group:RawGrade[]){
 const sampleSize=group.length;
 const wins=group.filter(x=>x.outcome).length;
 const hitRate=sampleSize?wins/sampleSize:0;
 const averagePrediction=mean(group.map(x=>x.predictedProbability));
 const brier=mean(group.map(x=>x.brier));
 const logLoss=mean(group.map(x=>x.logLoss));
 const calibrationError=mean(group.map(x=>x.calibrationError));
 const marketValues=group.map(x=>x.marketSkill).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));
 const marketSkill=marketValues.length?mean(marketValues):null;
 const shrink=sampleSize/(sampleSize+60);
 const calibrationComponent=clamp(1-calibrationError/.20);
 const brierComponent=clamp(1-brier/.35);
 const logComponent=clamp(1-logLoss/1.0);
 const marketComponent=marketSkill===null?.5:clamp(.5+marketSkill/.20);
 const raw=calibrationComponent*.30+brierComponent*.32+logComponent*.18+marketComponent*.20;
 const rating=Math.round((.50*(1-shrink)+raw*shrink)*1000)/10;
 return {sampleSize,wins,hitRate,averagePrediction,brier,logLoss,calibrationError,marketSkill,confidence:sampleConfidence(sampleSize),rating,evidence:evidence(sampleSize)};
}

function groupRows(rows:RawGrade[],dimension:SkillRatingRow['dimension'],keyOf:(row:RawGrade)=>string){
 const map=new Map<string,RawGrade[]>();
 for(const row of rows){
  const key=keyOf(row)||'UNKNOWN';
  map.set(key,[...(map.get(key)||[]),row]);
 }
 return [...map.entries()].map(([key,group])=>({
  domain:group[0]?.domain||'SPORTS',
  dimension,
  key,
  ...summarize(group)
 } satisfies SkillRatingRow));
}

async function loadRows():Promise<RawGrade[]>{
 const sql=db();
 if(!sql)return [];
 const universal=await sql.unsafe("select domain,category,venue,model_version as \"modelVersion\",coalesce(strategy_key,'GENERAL') as \"strategyKey\",predicted_probability::float8 as \"predictedProbability\",outcome,brier::float8,log_loss::float8 as \"logLoss\",calibration_error::float8 as \"calibrationError\",market_skill::float8 as \"marketSkill\" from universal_forecast_grades order by settled_at desc limit 20000");
 const historical=await sql.unsafe("select sport,market_key as \"marketKey\",model_name as \"modelName\",model_version as \"modelVersion\",predicted_probability::float8 as \"predictedProbability\",outcome from historical_predictions order by occurred_at desc limit 20000");
 const rows:RawGrade[]=(universal as any[]).map(x=>({
  domain:String(x.domain)==='MARKETS'?'MARKETS':'SPORTS',
  category:String(x.category||'OTHER'),
  venue:x.venue?String(x.venue):null,
  modelVersion:String(x.modelVersion||'unknown'),
  strategyKey:String(x.strategyKey||'GENERAL'),
  predictedProbability:Number(x.predictedProbability),
  outcome:Boolean(x.outcome),
  brier:Number(x.brier),
  logLoss:Number(x.logLoss),
  calibrationError:Number(x.calibrationError),
  marketSkill:x.marketSkill===null||x.marketSkill===undefined?null:Number(x.marketSkill)
 }));
 for(const x of historical as any[]){
  const p=clamp(Number(x.predictedProbability),.001,.999);
  const y=Number(x.outcome)===1;
  rows.push({
   domain:'SPORTS',
   category:String(x.sport||x.marketKey||'SPORTS'),
   venue:null,
   modelVersion:String(x.modelVersion||x.modelName||'legacy-sports'),
   strategyKey:'GENERAL',
   predictedProbability:p,
   outcome:y,
   brier:(p-(y?1:0))**2,
   logLoss:-(y?Math.log(p):Math.log(1-p)),
   calibrationError:Math.abs(p-(y?1:0)),
   marketSkill:null
  });
 }
 return rows;
}

export async function buildSkillRatings(){
 const rows=await loadRows();
 const ratings:SkillRatingRow[]=[];
 for(const domain of ['SPORTS','MARKETS'] as const){
  const scoped=rows.filter(x=>x.domain===domain);
  ratings.push(...groupRows(scoped,'MODEL',x=>x.modelVersion));
  ratings.push(...groupRows(scoped,'CATEGORY',x=>x.category));
  ratings.push(...groupRows(scoped,'VENUE',x=>x.venue||'UNSPECIFIED'));
  ratings.push(...groupRows(scoped,'PROBABILITY_BAND',x=>probabilityBand(x.predictedProbability)));
  ratings.push(...groupRows(scoped,'STRATEGY',x=>x.strategyKey));
 }
 ratings.sort((a,b)=>b.rating-a.rating||b.sampleSize-a.sampleSize);
 return {
  generatedAt:new Date().toISOString(),
  sampleSize:rows.length,
  ratings,
  sportsLeaders:ratings.filter(x=>x.domain==='SPORTS'&&x.sampleSize>=25).slice(0,25),
  marketsLeaders:ratings.filter(x=>x.domain==='MARKETS'&&x.sampleSize>=25).slice(0,25),
  warnings:[
   'Ratings use sample-size shrinkage; small hot streaks are pulled toward neutral.',
   'Leaderboard position cannot independently promote a production model.'
  ]
 };
}
