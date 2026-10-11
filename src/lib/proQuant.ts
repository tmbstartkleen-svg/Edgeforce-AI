/** Quant math and analytics. Descriptive market statistics != verified predictive edge. */
export function impliedProbability(odds:number){
 if(!Number.isFinite(odds)||!Number.isInteger(odds)||Math.abs(odds)<100||Math.abs(odds)>100000)return null;
 return odds<0?-odds/(-odds+100):100/(odds+100);
}
export function decimalOdds(odds:number){
 const p=impliedProbability(odds);return p===null?null:1/p;
}
export function americanOdds(p:number){
 if(!(p>0&&p<1)||!Number.isFinite(p))return null;
 return Math.round(p>=.5?-100*p/(1-p):100*(1-p)/p);
}
export function twoWayNoVig(a:number,b:number){
 const pa=impliedProbability(a),pb=impliedProbability(b);
 if(pa===null||pb===null||pa+pb<=0)return null;
 const total=pa+pb;
 if(total<.985||total>1.30)return null;
 return {a:pa/total,b:pb/total,hold:total-1,pa,pb};
}
export function expectedValue(prob:number,odds:number){
 const d=decimalOdds(odds);
 return d===null||!(prob>0&&prob<1)||!Number.isFinite(prob)?null:prob*d-1;
}
export function priceResearch(input:{referenceA:number;referenceB:number;offered:number;estimate?:number|null;books:number;quoteAgeMin:number}){
 const fair=twoWayNoVig(input.referenceA,input.referenceB);
 const fairP=fair?.a??null;
 const ev=fairP===null?null:expectedValue(fairP,input.offered);
 const flags:string[]=[];
 if(!fair)flags.push('Reference sides are invalid or margin is implausible');
 if(input.books<2)flags.push('Independent reference-book coverage below two');
 if(!Number.isFinite(input.quoteAgeMin)||input.quoteAgeMin<0||input.quoteAgeMin>2)flags.push('Quote freshness not verified');
 const p=input.estimate??null;
 if(p!==null&&!(p>0&&p<1))flags.push('Independent model probability invalid');
 const modelEv=p===null?null:expectedValue(p,input.offered);
 if(ev===null||ev<=0)flags.push('No positive market-reference edge');
 if(modelEv!==null&&modelEv<=0)flags.push('Independent model does not confirm price advantage');
 return {fairProbability:fairP,noVigOdds:fairP===null?null:americanOdds(fairP),
  referenceHold:fair?.hold??null,referenceEv:ev,modelEv,
  status:flags.length===0&&p!==null?'REVIEW_PRICE':'RESEARCH_ONLY',flags};
}
export type HistoricalBet={id:string;date:string;sport:string;selection:string;book:string;
 stake:number;odds:number;closingOdds:number|null;result:'WIN'|'LOSS'|'PUSH'|'OPEN'};
export function betProfit(b:HistoricalBet){
 if(b.result==='OPEN'||b.result==='PUSH')return 0;
 if(b.result==='LOSS')return -b.stake;
 const d=decimalOdds(b.odds);return d===null?0:b.stake*(d-1);
}
export function summarizeBets(bets:readonly HistoricalBet[]){
 const closed=bets.filter(b=>b.result!=='OPEN'&&Number.isFinite(b.stake)&&b.stake>0&&decimalOdds(b.odds)!==null);
 const stake=closed.reduce((n,b)=>n+b.stake,0);
 const profit=closed.reduce((n,b)=>n+betProfit(b),0);
 const decided=closed.filter(b=>b.result==='WIN'||b.result==='LOSS');
 const clvs=closed.filter(b=>b.closingOdds!==null&&impliedProbability(b.closingOdds)!==null)
  .map(b=>impliedProbability(b.closingOdds!)!-impliedProbability(b.odds)!);
 return {settled:closed.length,open:bets.filter(b=>b.result==='OPEN').length,stake,profit,
  roi:stake>0?profit/stake:null,
  winRate:decided.length?decided.filter(b=>b.result==='WIN').length/decided.length:null,
  meanClvImplied:clvs.length?clvs.reduce((a,b)=>a+b,0)/clvs.length:null,
  clvCount:clvs.length};
}
export type EpaRow={posteam:string;epa:number;play_type:'pass'|'run';success:number|null};
export function summarizeEpa(rows:readonly EpaRow[]){
 const teams=new Map<string,{team:string;plays:number;epa:number;passes:number;success:number;graded:number}>();
 for(const r of rows){
  if(!/^[A-Z]{2,4}$/.test(r.posteam)||!Number.isFinite(r.epa)||Math.abs(r.epa)>30||
   (r.play_type!=='pass'&&r.play_type!=='run'))continue;
  const x=teams.get(r.posteam)||{team:r.posteam,plays:0,epa:0,passes:0,success:0,graded:0};
  x.plays++;x.epa+=r.epa;if(r.play_type==='pass')x.passes++;
  if(r.success!==null&&(r.success===0||r.success===1)){x.success+=r.success;x.graded++}
  teams.set(r.posteam,x);
 }
 return [...teams.values()].filter(x=>x.plays>=3).map(x=>({
  team:x.team,plays:x.plays,epaPerPlay:x.epa/x.plays,
  successRate:x.graded?x.success/x.graded:null,passShare:x.passes/x.plays,
  status:'HISTORICAL_DESCRIPTIVE' as const
 })).sort((a,b)=>b.epaPerPlay-a.epaPerPlay);
}
