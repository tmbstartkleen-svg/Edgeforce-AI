/** Conservative reconciliation and retrospective model quality.
 * No fuzzy event merge, forecast leakage or credit for unverified final scores.
 */
export function normalizedIdentity(value:unknown){
 return typeof value==='string'?value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '):'';
}
export type EventIdentityInput={
 sport:string;league:string|null;home:string;away:string;startsAt:string;
 outcomeSport:string;outcomeLeague:string|null;outcomeHome:string;outcomeAway:string;outcomeAt:string;
};
export function evaluateEventIdentity(x:EventIdentityInput){
 const reasons:string[]=[];
 const home=normalizedIdentity(x.home),away=normalizedIdentity(x.away);
 if(!home||!away||home===away||home.length<3||away.length<3)reasons.push('Invalid canonical teams');
 if(home!==normalizedIdentity(x.outcomeHome)||away!==normalizedIdentity(x.outcomeAway))reasons.push('Home/away names differ');
 if(normalizedIdentity(x.sport)!==normalizedIdentity(x.outcomeSport))reasons.push('Sport mismatch');
 if(normalizedIdentity(x.league||'')!==normalizedIdentity(x.outcomeLeague||''))reasons.push('League mismatch');
 const a=Date.parse(x.startsAt),b=Date.parse(x.outcomeAt);
 if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>10*60000)reasons.push('Kickoff exceeds 10-minute tolerance');
 return {match:reasons.length===0,method:'EXACT_TEAM_LEAGUE_AND_KICKOFF' as const,reasons};
}
export type BacktestSample={
 eventId:string;sport:string;modelVersion:string;selection:string;
 modelProbability:number;homeScore:number;awayScore:number;
 homeName:string;awayName:string;canonicalHomeId:string|null;canonicalAwayId:string|null;
 predictionTime:string;scheduledAt:string;outcomeEvidence:string;upstreamCount:number;
};
export type GradedBacktest={
 eventId:string;sport:string;modelVersion:string;selection:string;predicted:number;
 outcome:0|1;brier:number;logLoss:number;
};
export function gradeBacktestSample(s:BacktestSample){
 if(s.outcomeEvidence!=='CROSS_SOURCE_AGREED'||s.upstreamCount<2)
  return {ok:false as const,reason:'INSUFFICIENT_INDEPENDENT_RESULTS'};
 const predicted=Number(s.modelProbability);
 const start=Date.parse(s.scheduledAt),created=Date.parse(s.predictionTime);
 if(!Number.isFinite(start)||!Number.isFinite(created)||created>=start||created<start-60*86400000)
  return {ok:false as const,reason:'PREMATCH_TIMING_NOT_PROVEN'};
 if(!(predicted>0&&predicted<1)||!Number.isFinite(predicted))
  return {ok:false as const,reason:'INVALID_PROBABILITY'};
 if(!Number.isSafeInteger(s.homeScore)||!Number.isSafeInteger(s.awayScore)||
  s.homeScore<0||s.awayScore<0||s.homeScore===s.awayScore)
  return {ok:false as const,reason:'DRAW_OR_INVALID_SCORE'};
 const choice=normalizedIdentity(s.selection);
 const home=normalizedIdentity(s.homeName),away=normalizedIdentity(s.awayName);
 const homeId=normalizedIdentity(s.canonicalHomeId||''),awayId=normalizedIdentity(s.canonicalAwayId||'');
 const onHome=choice.length>0&&(choice===home||homeId.length>0&&choice===homeId);
 const onAway=choice.length>0&&(choice===away||awayId.length>0&&choice===awayId);
 if(onHome===onAway)return {ok:false as const,reason:'UNMATCHED_OR_AMBIGUOUS_TEAM_SELECTION'};
 const outcome=(onHome?s.homeScore>s.awayScore:s.awayScore>s.homeScore)?1:0;
 const p=predicted;
 return {ok:true as const,entry:{
  eventId:s.eventId,sport:s.sport,modelVersion:s.modelVersion,selection:s.selection,
  predicted:p,outcome:outcome as 0|1,brier:(p-outcome)**2,
  logLoss:-(outcome*Math.log(p)+(1-outcome)*Math.log(1-p))
 } satisfies GradedBacktest};
}
export function summarizeBacktests(samples:readonly BacktestSample[]){
 const graded:GradedBacktest[]=[];const rejected:Record<string,number>={};
 const seen=new Set<string>();
 for(const s of samples){
  const key=[s.eventId,s.modelVersion].join('|');
  if(seen.has(key)){rejected.DUPLICATE_EVENT_MODEL=(rejected.DUPLICATE_EVENT_MODEL||0)+1;continue}
  seen.add(key);
  const result=gradeBacktestSample(s);
  if(result.ok)graded.push(result.entry);
  else rejected[result.reason]=(rejected[result.reason]||0)+1;
 }
 const grouped=new Map<string,GradedBacktest[]>();
 for(const item of graded){
  const key=item.sport+'|'+item.modelVersion;
  const list=grouped.get(key)||[];list.push(item);grouped.set(key,list);
 }
 const rows=[...grouped.entries()].map(([key,entries])=>{
  const [sport,modelVersion]=key.split('|');
  const count=entries.length,mean=(f:(x:GradedBacktest)=>number)=>entries.reduce((a,x)=>a+f(x),0)/count;
  // Expected calibration error across fixed probability buckets.
  let ece=0;
  for(let bin=0;bin<10;bin++){
   const bucket=entries.filter(x=>Math.min(9,Math.floor(x.predicted*10))===bin);
   if(bucket.length)ece+=bucket.length/count*Math.abs(
    bucket.reduce((a,x)=>a+x.predicted,0)/bucket.length-
    bucket.reduce((a,x)=>a+x.outcome,0)/bucket.length);
  }
  return {
   sport,modelVersion,sampleSize:count,accuracy:mean(x=>x.outcome===Number(x.predicted>=.5)?1:0),
   brierScore:mean(x=>x.brier),logLoss:mean(x=>x.logLoss),calibrationError:ece,
   quality:count>=200?'RESEARCH_SAMPLE_ONLY':count>=30?'SMALL_SAMPLE':'INSUFFICIENT_SAMPLE',
   outOfSampleProven:false,independentScoreSourcesMin:2,tradeApproved:false
  };
 }).sort((a,b)=>b.sampleSize-a.sampleSize).slice(0,25);
 return {
  dataRole:'RETROSPECTIVE_INDEPENDENT_SCORE_BACKTEST' as const,
  reviewed:samples.length,graded:graded.length,rejected,
  results:rows,
  warning:'Two independent agreeing final-score sources are required. Metrics describe retrospective observed match results, not independently audited out-of-sample forecasting. Excludes ties, player props, spreads, totals, and unmatched selections; do not infer live wagering edge.'
 };
}
