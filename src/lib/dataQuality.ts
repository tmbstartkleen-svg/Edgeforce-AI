import type {Market} from './types';

export type ProviderObservation={
 provider:string;
 marketId:string;
 odds:number;
 pulledAt:string|Date;
 complete:boolean;
 lineupCertainty?:number;
 sourceAgreement?:number;
};

export type QualityResult={
 score:number;
 grade:'TRUSTED'|'USABLE'|'CAUTION'|'SUPPRESS';
 freshness:number;
 completeness:number;
 agreement:number;
 lineupCertainty:number;
 duplicatePenalty:number;
 reasons:string[];
 suppress:boolean;
};

const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));

export function scoreDataQuality(m:Market,observations:ProviderObservation[]=[]):QualityResult{
 const age=Math.max(0,m.sourceAgeMin);
 const freshness=age<=2?1:age<=5?.92:age<=10?.78:age<=20?.58:age<=60?.30:.08;
 const completeness=observations.length?observations.filter(x=>x.complete).length/observations.length:1;
 const prices=observations.map(x=>x.odds).filter(Number.isFinite);
 const spread=prices.length>1?Math.max(...prices)-Math.min(...prices):0;
 const agreement=prices.length<=1?.85:clamp(1-Math.abs(spread)/120);
 const lineupCertainty=observations.length?observations.reduce((s,x)=>s+(x.lineupCertainty??.75),0)/observations.length:.75;
 const unique=new Set(observations.map(x=>x.provider+'|'+x.marketId+'|'+x.odds+'|'+new Date(x.pulledAt).toISOString()));
 const duplicatePenalty=observations.length?clamp(1-unique.size/observations.length):0;
 const score=clamp(.34*freshness+.22*completeness+.22*agreement+.18*lineupCertainty-.12*duplicatePenalty);
 const reasons:string[]=[];
 if(freshness<.5)reasons.push('Source data is aging or stale');
 if(completeness<.8)reasons.push('Provider coverage is incomplete');
 if(agreement<.65)reasons.push('Providers materially disagree');
 if(lineupCertainty<.65)reasons.push('Lineup or availability certainty is low');
 if(duplicatePenalty>.15)reasons.push('Duplicate feed observations detected');
 if(!reasons.length)reasons.push('Fresh, complete, and internally consistent');
 const grade:QualityResult['grade']=score>=.82?'TRUSTED':score>=.68?'USABLE':score>=.5?'CAUTION':'SUPPRESS';
 return {score,grade,freshness,completeness,agreement,lineupCertainty,duplicatePenalty,reasons,suppress:grade==='SUPPRESS'};
}


export type MarketContractIssue={
 index:number;
 id:string;
 code:string;
 severity:'ERROR'|'WARN';
 detail:string;
};

export type MarketBatchAudit={
 score:number;
 grade:'TRUSTED'|'USABLE'|'CAUTION'|'REJECT';
 rowCount:number;
 validRows:number;
 invalidRows:number;
 duplicateRows:number;
 staleRows:number;
 agingRows:number;
 multiBookRows:number;
 targetBookRows:number;
 featureRows:number;
 averageSourceAgeMin:number;
 consensusDepthCoverage:number;
 targetBookCoverage:number;
 featureCoverage:number;
 structureScore:number;
 probabilityScore:number;
 freshnessScore:number;
 uniquenessScore:number;
 consensusScore:number;
 featureScore:number;
 blockers:string[];
 warnings:string[];
 issues:MarketContractIssue[];
};

const requiredString=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const probability=(v:unknown)=>Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<1;
const americanOdds=(v:unknown)=>{
 const n=Number(v);
 return Number.isFinite(n)&&Math.abs(n)>=100&&Math.abs(n)<=100000;
};

export function auditMarketBatch(markets:Market[]):MarketBatchAudit{
 if(!markets.length){
  return {
   score:.60,grade:'CAUTION',rowCount:0,validRows:0,invalidRows:0,duplicateRows:0,
   staleRows:0,agingRows:0,multiBookRows:0,targetBookRows:0,featureRows:0,
   averageSourceAgeMin:0,consensusDepthCoverage:0,targetBookCoverage:0,featureCoverage:0,
   structureScore:.6,probabilityScore:.6,freshnessScore:.6,uniquenessScore:1,
   consensusScore:.5,featureScore:.4,blockers:[],
   warnings:['No active market rows were available for batch validation'],issues:[]
  };
 }

 const issues:MarketContractIssue[]=[];
 const seen=new Set<string>();
 let duplicateRows=0,staleRows=0,agingRows=0,multiBookRows=0,targetBookRows=0,featureRows=0;
 let ageSum=0,structurePass=0,probabilityPass=0;

 markets.forEach((m,index)=>{
  const id=requiredString(m.id)?m.id:`row-${index}`;
  const rowIssues:MarketContractIssue[]=[];
  const required:{key:string;value:unknown}[]=[
   {key:'id',value:m.id},{key:'sport',value:m.sport},{key:'league',value:m.league},
   {key:'event',value:m.event},{key:'selection',value:m.selection},{key:'market',value:m.market},
   {key:'home',value:m.home},{key:'away',value:m.away}
  ];
  for(const item of required){
   if(!requiredString(item.value))rowIssues.push({index,id,code:`MISSING_${item.key.toUpperCase()}`,severity:'ERROR',detail:`${item.key} is required`});
  }
  const startMs=new Date(m.startTime).getTime();
  if(!Number.isFinite(startMs))rowIssues.push({index,id,code:'INVALID_START_TIME',severity:'ERROR',detail:'startTime is not a valid date'});
  if(!americanOdds(m.odds))rowIssues.push({index,id,code:'INVALID_AMERICAN_ODDS',severity:'ERROR',detail:`odds ${String(m.odds)} are outside American-odds contract`});
  if(!probability(m.marketProb))rowIssues.push({index,id,code:'INVALID_MARKET_PROBABILITY',severity:'ERROR',detail:`marketProb ${String(m.marketProb)} must be between 0 and 1`});
  if(!probability(m.modelProb))rowIssues.push({index,id,code:'INVALID_MODEL_PROBABILITY',severity:'ERROR',detail:`modelProb ${String(m.modelProb)} must be between 0 and 1`});
  if(!Number.isFinite(Number(m.confidence))||Number(m.confidence)<0||Number(m.confidence)>1){
   rowIssues.push({index,id,code:'INVALID_CONFIDENCE',severity:'ERROR',detail:`confidence ${String(m.confidence)} must be between 0 and 1`});
  }
  if(!Number.isFinite(Number(m.sourceAgeMin))||Number(m.sourceAgeMin)<0){
   rowIssues.push({index,id,code:'INVALID_SOURCE_AGE',severity:'ERROR',detail:'sourceAgeMin must be a non-negative number'});
  }

  const age=Math.max(0,Number(m.sourceAgeMin)||0);
  ageSum+=age;
  if(age>60){staleRows++;rowIssues.push({index,id,code:'STALE_SOURCE',severity:'WARN',detail:`source age ${age.toFixed(1)}m exceeds 60m`});}
  else if(age>20){agingRows++;rowIssues.push({index,id,code:'AGING_SOURCE',severity:'WARN',detail:`source age ${age.toFixed(1)}m exceeds 20m`});}

  const identity=[m.id,m.market,m.selection].map(x=>String(x||'').trim().toLowerCase()).join('|');
  if(seen.has(identity)){
   duplicateRows++;
   rowIssues.push({index,id,code:'DUPLICATE_MARKET_IDENTITY',severity:'ERROR',detail:'event + market + selection is duplicated in this batch'});
  }else seen.add(identity);

  if(m.consensus){
   if(!probability(m.consensus.consensusProbability)){
    rowIssues.push({index,id,code:'INVALID_CONSENSUS_PROBABILITY',severity:'ERROR',detail:'consensus probability must be between 0 and 1'});
   }
   if(m.consensus.bookCount>=2)multiBookRows++;
   if(m.consensus.targetBookFound)targetBookRows++;
   if(m.consensus.bookCount<2)rowIssues.push({index,id,code:'THIN_CONSENSUS',severity:'WARN',detail:'fewer than two books contribute to consensus'});
  }
  if(Object.keys(m.sportFeatures||{}).length>0)featureRows++;

  if(!rowIssues.some(x=>x.severity==='ERROR'&&x.code.startsWith('MISSING_'))&&!rowIssues.some(x=>['INVALID_START_TIME','INVALID_AMERICAN_ODDS'].includes(x.code)))structurePass++;
  if(!rowIssues.some(x=>['INVALID_MARKET_PROBABILITY','INVALID_MODEL_PROBABILITY','INVALID_CONFIDENCE','INVALID_CONSENSUS_PROBABILITY'].includes(x.code)))probabilityPass++;
  issues.push(...rowIssues);
 });

 const rowCount=markets.length;
 const invalidIdentities=new Set(issues.filter(x=>x.severity==='ERROR').map(x=>x.index));
 const invalidRows=invalidIdentities.size;
 const validRows=rowCount-invalidRows;
 const averageSourceAgeMin=ageSum/rowCount;
 const structureScore=structurePass/rowCount;
 const probabilityScore=probabilityPass/rowCount;
 const freshnessScore=clamp(1-(staleRows/rowCount)*.85-(agingRows/rowCount)*.30);
 const uniquenessScore=clamp(1-duplicateRows/rowCount);
 const consensusRows=markets.filter(x=>Boolean(x.consensus)).length;
 const consensusDepthCoverage=multiBookRows/rowCount;
 const targetBookCoverage=targetBookRows/rowCount;
 const consensusScore=consensusRows
  ?clamp(.45*(consensusRows/rowCount)+.35*consensusDepthCoverage+.20*targetBookCoverage)
  :.55;
 const featureCoverage=featureRows/rowCount;
 const featureScore=.40+.60*featureCoverage;
 const score=clamp(
  structureScore*.28+
  probabilityScore*.22+
  freshnessScore*.18+
  uniquenessScore*.12+
  consensusScore*.10+
  featureScore*.10
 );
 const invalidRate=invalidRows/rowCount;
 const duplicateRate=duplicateRows/rowCount;
 const staleRate=staleRows/rowCount;
 const blockers:string[]=[];
 const warnings:string[]=[];
 if(invalidRate>.05)blockers.push(`Invalid market contract rate ${(invalidRate*100).toFixed(1)}% exceeds 5%`);
 if(duplicateRate>.10)blockers.push(`Duplicate market rate ${(duplicateRate*100).toFixed(1)}% exceeds 10%`);
 if(staleRate>.50)blockers.push(`Stale market rate ${(staleRate*100).toFixed(1)}% exceeds 50%`);
 if(score<.58)blockers.push(`Batch quality score ${score.toFixed(3)} is below 0.580`);
 if(invalidRows>0)warnings.push(`${invalidRows} row(s) violate the market contract`);
 if(duplicateRows>0)warnings.push(`${duplicateRows} duplicate market identity row(s) detected`);
 if(staleRows>0)warnings.push(`${staleRows} stale row(s) exceed 60 minutes`);
 if(consensusDepthCoverage<.30)warnings.push(`Multi-book consensus covers only ${(consensusDepthCoverage*100).toFixed(0)}% of rows`);
 if(featureCoverage<.30)warnings.push(`Context feature coverage is ${(featureCoverage*100).toFixed(0)}%`);
 const grade:MarketBatchAudit['grade']=score>=.92?'TRUSTED':score>=.80?'USABLE':score>=.58?'CAUTION':'REJECT';

 return {
  score,grade,rowCount,validRows,invalidRows,duplicateRows,staleRows,agingRows,multiBookRows,
  targetBookRows,featureRows,averageSourceAgeMin,consensusDepthCoverage,targetBookCoverage,
  featureCoverage,structureScore,probabilityScore,freshnessScore,uniquenessScore,
  consensusScore,featureScore,blockers,warnings,issues:issues.slice(0,250)
 };
}
