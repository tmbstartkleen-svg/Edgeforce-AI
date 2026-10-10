import type {Market} from './types';
import {canonicalConsensusMarket,canonicalConsensusSelection,normalizeConsensusText} from './marketConsensus';
import {decimalOdds,impliedProbability,ev,kelly,fairAmerican} from './math';

export type EdgeScannerQuote={
 marketId:string;
 sport:string;
 league:string;
 event:string;
 market:string;
 selection:string;
 startTime:string;
 book:string;
 providerId?:string;
 odds:number;
 decimal:number;
 impliedProbability:number;
};

export type ArbitrageOpportunity={
 key:string;
 sport:string;
 league:string;
 event:string;
 market:string;
 startTime:string;
 outcomeCount:number;
 impliedProbabilitySum:number;
 roi:number;
 stakePlan:Array<{
  selection:string;
  book:string;
  odds:number;
  stakeFraction:number;
  payoutMultiple:number;
 }>;
};

export type PositiveEvOpportunity={
 key:string;
 sport:string;
 league:string;
 event:string;
 market:string;
 selection:string;
 startTime:string;
 book:string;
 odds:number;
 fairProbability:number;
 fairOdds:number;
 edge:number;
 expectedValue:number;
 fullKelly:number;
 fractionalKelly:number;
 reference:string;
 referenceBooks:string[];
};

export type EdgeScannerResult={
 generatedAt:string;
 quoteCount:number;
 groupCount:number;
 arbitrageCount:number;
 positiveEvCount:number;
 sharpReferenceGroups:number;
 consensusReferenceGroups:number;
 arbitrage:ArbitrageOpportunity[];
 positiveEv:PositiveEvOpportunity[];
 methodology:{
  arbitrage:string;
  devig:string;
  expectedValue:string;
  kellyFraction:number;
  extraProviderRequests:number;
 };
};

type GroupedQuote=EdgeScannerQuote&{
 groupKey:string;
 outcomeKey:string;
};

const norm=(value:string)=>normalizeConsensusText(value);
const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));
const SHARP_BOOKS=['pinnacle','circa','bookmaker','bookmaker.eu'];

function cleanSelection(selection:string){
 return canonicalConsensusSelection(selection)
  .replace(/\s+/g,' ')
  .trim();
}

function lineNumber(selection:string){
 const matches=[...selection.matchAll(/([+-]?\d+(?:\.\d+)?)/g)];
 if(!matches.length)return undefined;
 const n=Number(matches[matches.length-1][1]);
 return Number.isFinite(n)?n:undefined;
}

function playerBase(m:Market){
 const player=m.playerContext?.name?.trim();
 if(player)return norm(player);
 const selection=cleanSelection(m.selection);
 const overUnder=selection.match(/^(.*?)\s+(over|under)\s+[+-]?\d+(?:\.\d+)?$/i);
 if(overUnder?.[1])return norm(overUnder[1]);
 const yesNo=selection.match(/^(.*?)\s+(yes|no)$/i);
 if(yesNo?.[1])return norm(yesNo[1]);
 return '';
}

function quoteGrouping(m:Market){
 const market=canonicalConsensusMarket(m.market);
 const selection=cleanSelection(m.selection);
 const line=lineNumber(selection);
 const sport=norm(m.sport);
 const home=norm(m.home);
 const away=norm(m.away);
 const start=new Date(m.startTime).toISOString();

 let family='';
 let outcome=norm(selection);

 const ou=selection.match(/^(.*?)\s+(over|under)\s+([+-]?\d+(?:\.\d+)?)$/i);
 if(ou){
  const base=norm(ou[1]||playerBase(m));
  const lineValue=Math.abs(Number(ou[3]));
  family=`${base}|${lineValue}`;
  outcome=ou[2].toLowerCase();
 }else if(market==='total'){
  family=line===undefined?'':String(Math.abs(line));
  outcome=/under/i.test(selection)?'under':/over/i.test(selection)?'over':norm(selection);
 }else if(market==='spread'){
  family=line===undefined?'':String(Math.abs(line));
  outcome=norm(selection.replace(/\s+[+-]?\d+(?:\.\d+)?\s*$/,''));
 }else if(market==='moneyline'){
  family='';
  outcome=norm(selection);
 }else if(/^player[_\s-]/i.test(m.market)||m.playerContext?.name){
  const base=playerBase(m);
  const side=/\bover\b/i.test(selection)?'over':/\bunder\b/i.test(selection)?'under':/\byes\b/i.test(selection)?'yes':/\bno\b/i.test(selection)?'no':norm(selection);
  family=`${base}|${line===undefined?'':Math.abs(line)}`;
  outcome=side;
 }else{
  const yesNo=selection.match(/^(.*?)\s+(yes|no)$/i);
  if(yesNo){
   family=norm(yesNo[1]);
   outcome=yesNo[2].toLowerCase();
  }else{
   family=norm(selection);
  }
 }

 const groupKey=[sport,home,away,market,family,start].join('|');
 return {groupKey,outcomeKey:outcome};
}

function asQuotes(markets:Market[]):GroupedQuote[]{
 const out:GroupedQuote[]=[];
 for(const m of markets){
  if(!Number.isFinite(m.odds)||m.odds===0)continue;
  const book=(m.sourceBook||m.sourceProviderId||'unknown').trim();
  if(!book)continue;
  const {groupKey,outcomeKey}=quoteGrouping(m);
  out.push({
   marketId:m.id,
   sport:m.sport,
   league:m.league,
   event:m.event,
   market:m.market,
   selection:m.selection,
   startTime:m.startTime,
   book,
   providerId:m.sourceProviderId,
   odds:m.odds,
   decimal:decimalOdds(m.odds),
   impliedProbability:impliedProbability(m.odds),
   groupKey,
   outcomeKey
  });
 }
 return out;
}

function powerDevig(raw:number[]){
 if(raw.length<2)return raw.map(x=>clamp(x,.001,.999));
 const total=raw.reduce((s,x)=>s+x,0);
 if(total<=1.000001)return raw.map(x=>clamp(x/Math.max(total,.0001),.001,.999));

 let low=.05,high=8;
 for(let i=0;i<80;i++){
  const mid=(low+high)/2;
  const sum=raw.reduce((s,p)=>s+Math.pow(clamp(p,.000001,.999999),mid),0);
  if(sum>1)low=mid;
  else high=mid;
 }
 const k=(low+high)/2;
 const powered=raw.map(p=>Math.pow(clamp(p,.000001,.999999),k));
 const sum=powered.reduce((s,x)=>s+x,0);
 return powered.map(x=>clamp(x/Math.max(sum,.000001),.001,.999));
}

function bestPerOutcome(rows:GroupedQuote[]){
 const map=new Map<string,GroupedQuote>();
 for(const row of rows){
  const prior=map.get(row.outcomeKey);
  if(!prior||row.decimal>prior.decimal)map.set(row.outcomeKey,row);
 }
 return [...map.values()];
}

function requiredOutcomes(rows:GroupedQuote[]){
 const market=canonicalConsensusMarket(rows[0]?.market||'');
 const sport=norm(rows[0]?.sport||'');
 if(market==='moneyline'&&/soccer|football.*eng|mls|epl/.test(sport))return 3;
 return 2;
}

function referenceProbabilities(rows:GroupedQuote[]){
 const outcomes=[...new Set(rows.map(x=>x.outcomeKey))];
 const required=requiredOutcomes(rows);

 for(const sharp of SHARP_BOOKS){
  const bookRows=rows.filter(x=>norm(x.book)===sharp||norm(x.book).includes(sharp));
  const byOutcome=new Map<string,GroupedQuote>();
  for(const row of bookRows){
   const prior=byOutcome.get(row.outcomeKey);
   if(!prior||row.decimal>prior.decimal)byOutcome.set(row.outcomeKey,row);
  }
  if(byOutcome.size>=required&&outcomes.every(o=>byOutcome.has(o))){
   const ordered=outcomes.map(o=>byOutcome.get(o)!);
   const fair=powerDevig(ordered.map(x=>x.impliedProbability));
   return {
    probabilities:new Map(outcomes.map((o,i)=>[o,fair[i]])),
    reference:'Pinnacle/sharp',
    books:[...new Set(ordered.map(x=>x.book))]
   };
  }
 }

 const averages=outcomes.map(outcome=>{
  const selected=rows.filter(x=>x.outcomeKey===outcome);
  return selected.length
   ?selected.reduce((s,x)=>s+x.impliedProbability,0)/selected.length
   :.5;
 });
 const fair=powerDevig(averages);
 return {
  probabilities:new Map(outcomes.map((o,i)=>[o,fair[i]])),
  reference:'multi-book consensus',
  books:[...new Set(rows.map(x=>x.book))]
 };
}

export function scanEdgeOpportunities(
 panelMarkets:Market[],
 options:{kellyFraction?:number;minEv?:number;maxArbitrage?:number;maxPositiveEv?:number}={}
):EdgeScannerResult{
 const kellyFraction=clamp(options.kellyFraction??.25,.01,1);
 const minEv=Math.max(0,options.minEv??.01);
 const quotes=asQuotes(panelMarkets);
 const groups=new Map<string,GroupedQuote[]>();
 for(const quote of quotes){
  const list=groups.get(quote.groupKey)||[];
  list.push(quote);
  groups.set(quote.groupKey,list);
 }

 const arbitrage:ArbitrageOpportunity[]=[];
 const positiveEv:PositiveEvOpportunity[]=[];
 let sharpReferenceGroups=0;
 let consensusReferenceGroups=0;

 for(const [key,rows] of groups){
  const outcomes=[...new Set(rows.map(x=>x.outcomeKey))];
  const required=requiredOutcomes(rows);
  if(outcomes.length<required)continue;

  const best=bestPerOutcome(rows);
  if(best.length>=required){
   const inverse=best.map(x=>1/x.decimal);
   const sum=inverse.reduce((s,x)=>s+x,0);
   if(sum>0&&sum<.9995){
    arbitrage.push({
     key,
     sport:rows[0].sport,
     league:rows[0].league,
     event:rows[0].event,
     market:rows[0].market,
     startTime:rows[0].startTime,
     outcomeCount:best.length,
     impliedProbabilitySum:sum,
     roi:1/sum-1,
     stakePlan:best.map((x,i)=>({
      selection:x.selection,
      book:x.book,
      odds:x.odds,
      stakeFraction:inverse[i]/sum,
      payoutMultiple:1/sum
     }))
    });
   }
  }

  const ref=referenceProbabilities(rows);
  if(ref.reference==='Pinnacle/sharp')sharpReferenceGroups++;
  else consensusReferenceGroups++;

  for(const outcome of outcomes){
   const fairP=ref.probabilities.get(outcome);
   if(!fairP)continue;
   const candidates=rows.filter(x=>x.outcomeKey===outcome);
   const bestQuote=[...candidates].sort((a,b)=>b.decimal-a.decimal)[0];
   if(!bestQuote)continue;
   const expected=ev(fairP,bestQuote.odds);
   if(expected<minEv)continue;
   const fullKelly=kelly(fairP,bestQuote.odds);
   positiveEv.push({
    key,
    sport:bestQuote.sport,
    league:bestQuote.league,
    event:bestQuote.event,
    market:bestQuote.market,
    selection:bestQuote.selection,
    startTime:bestQuote.startTime,
    book:bestQuote.book,
    odds:bestQuote.odds,
    fairProbability:fairP,
    fairOdds:fairAmerican(fairP),
    edge:fairP-bestQuote.impliedProbability,
    expectedValue:expected,
    fullKelly,
    fractionalKelly:fullKelly*kellyFraction,
    reference:ref.reference,
    referenceBooks:ref.books
   });
  }
 }

 arbitrage.sort((a,b)=>b.roi-a.roi);
 positiveEv.sort((a,b)=>b.expectedValue-a.expectedValue);

 return {
  generatedAt:new Date().toISOString(),
  quoteCount:quotes.length,
  groupCount:groups.size,
  arbitrageCount:arbitrage.length,
  positiveEvCount:positiveEv.length,
  sharpReferenceGroups,
  consensusReferenceGroups,
  arbitrage:arbitrage.slice(0,options.maxArbitrage??25),
  positiveEv:positiveEv.slice(0,options.maxPositiveEv??50),
  methodology:{
   arbitrage:'best-price inverse-decimal sum across complete outcome sets',
   devig:'power-method devig with Pinnacle/sharp reference when a complete sharp market exists; multi-book consensus fallback otherwise',
   expectedValue:'fair probability versus best available market price',
   kellyFraction,
   extraProviderRequests:0
  }
 };
}
