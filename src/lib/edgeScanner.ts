import type {Market} from './types';
import {decimalOdds,impliedProbability,ev,kelly,fairAmerican} from './math';

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
 rejectedSuspiciousArbitrage:number;
 rejectedSuspiciousEv:number;
 arbitrage:ArbitrageOpportunity[];
 positiveEv:PositiveEvOpportunity[];
 methodology:{
  arbitrage:string;
  devig:string;
  expectedValue:string;
  kellyFraction:number;
  extraProviderRequests:number;
  playerProps:string;
 };
};

type MarketKind='MONEYLINE_2WAY'|'MONEYLINE_3WAY'|'TOTAL_2WAY'|'SPREAD_2WAY';

type Quote={
 marketId:string;
 sport:string;
 league:string;
 event:string;
 market:string;
 selection:string;
 startTime:string;
 book:string;
 odds:number;
 decimal:number;
 impliedProbability:number;
 groupKey:string;
 outcomeKey:string;
 kind:MarketKind;
};

const SHARP_BOOKS=['pinnacle','circa','bookmaker','bookmaker.eu'];
const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));
const text=(v:unknown)=>String(v??'').trim();
const norm=(v:unknown)=>text(v).toLowerCase().replace(/[^a-z0-9.+-]+/g,' ').replace(/\s+/g,' ').trim();

function numericLine(selection:string){
 const matches=selection.match(/[+-]?\d+(?:\.\d+)?/g);
 if(!matches?.length)return undefined;
 const n=Number(matches[matches.length-1]);
 return Number.isFinite(n)?n:undefined;
}

function marketKind(m:Market){
 const raw=norm(m.market);
 if(raw.startsWith('player')||m.playerContext?.name)return null;

 if(raw==='h2h'||raw==='ml'||raw.includes('moneyline')||raw.includes('money line')){
  const soccer=/soccer|\bmls\b|\bepl\b|premier league|la liga|bundesliga|serie a|ligue 1/i.test(`${m.sport} ${m.league}`);
  return soccer?'MONEYLINE_3WAY' as const:'MONEYLINE_2WAY' as const;
 }
 if(raw.includes('spread')||raw.includes('run line')||raw.includes('runline')||raw.includes('puck line')||raw.includes('handicap')){
  return 'SPREAD_2WAY' as const;
 }
 if(raw.includes('total')||raw==='totals'){
  return 'TOTAL_2WAY' as const;
 }
 return null;
}

function teamSide(selection:string,home:string,away:string){
 const value=norm(selection.replace(/\b(moneyline|money line|ml)\b/ig,'').replace(/\s+[+-]?\d+(?:\.\d+)?\s*$/,''));
 const h=norm(home);
 const a=norm(away);
 if(value&&h&&(value===h||value.includes(h)||h.includes(value)))return 'home';
 if(value&&a&&(value===a||value.includes(a)||a.includes(value)))return 'away';
 if(/^(draw|tie|x)$/.test(value))return 'draw';
 return '';
}

function parseQuote(m:Market):Quote|null{
 if(!m||!Number.isFinite(m.odds)||m.odds===0)return null;
 if(!m.sport||!m.event||!m.market||!m.selection||!m.startTime)return null;

 const date=new Date(m.startTime);
 if(!Number.isFinite(date.getTime()))return null;

 const kind=marketKind(m);
 if(!kind)return null;

 const selection=text(m.selection);
 const line=numericLine(selection);
 let outcomeKey='';
 let family='';

 if(kind==='TOTAL_2WAY'){
  outcomeKey=/\bunder\b/i.test(selection)?'under':/\bover\b/i.test(selection)?'over':'';
  if(!outcomeKey||line===undefined)return null;
  family=String(Math.abs(line));
 }else if(kind==='SPREAD_2WAY'){
  outcomeKey=teamSide(selection,m.home,m.away);
  if((outcomeKey!=='home'&&outcomeKey!=='away')||line===undefined)return null;
  family=String(Math.abs(line));
 }else{
  outcomeKey=teamSide(selection,m.home,m.away);
  if(kind==='MONEYLINE_2WAY'&&outcomeKey!=='home'&&outcomeKey!=='away')return null;
  if(kind==='MONEYLINE_3WAY'&&!['home','draw','away'].includes(outcomeKey))return null;
 }

 const groupKey=[
  norm(m.sport),
  norm(m.home),
  norm(m.away),
  kind,
  family,
  date.toISOString()
 ].join('|');

 return {
  marketId:m.id,
  sport:m.sport,
  league:m.league,
  event:m.event,
  market:m.market,
  selection:m.selection,
  startTime:m.startTime,
  book:text(m.sourceBook||m.sourceProviderId||'unknown'),
  odds:m.odds,
  decimal:decimalOdds(m.odds),
  impliedProbability:impliedProbability(m.odds),
  groupKey,
  outcomeKey,
  kind
 };
}

function expectedOutcomes(kind:MarketKind){
 if(kind==='MONEYLINE_3WAY')return ['home','draw','away'];
 if(kind==='TOTAL_2WAY')return ['over','under'];
 return ['home','away'];
}

function completeGroup(rows:Quote[]){
 if(!rows.length)return null;
 const kind=rows[0].kind;
 if(rows.some(x=>x.kind!==kind))return null;
 const expected=expectedOutcomes(kind);
 const present=new Set(rows.map(x=>x.outcomeKey));
 if(expected.some(x=>!present.has(x)))return null;
 if([...present].some(x=>!expected.includes(x)))return null;
 return expected;
}

function bestPerOutcome(rows:Quote[],expected:string[]){
 return expected.map(outcome=>{
  const candidates=rows.filter(x=>x.outcomeKey===outcome);
  return [...candidates].sort((a,b)=>b.decimal-a.decimal)[0];
 }).filter((x):x is Quote=>Boolean(x));
}

function powerDevig(raw:number[]){
 if(raw.length<2)return raw;
 let low=.05;
 let high=8;
 for(let i=0;i<80;i++){
  const mid=(low+high)/2;
  const sum=raw.reduce((s,p)=>s+Math.pow(clamp(p,.000001,.999999),mid),0);
  if(sum>1)low=mid;
  else high=mid;
 }
 const k=(low+high)/2;
 const adjusted=raw.map(p=>Math.pow(clamp(p,.000001,.999999),k));
 const sum=adjusted.reduce((s,x)=>s+x,0);
 return adjusted.map(x=>x/Math.max(sum,.000001));
}

function sharpReference(rows:Quote[],expected:string[]){
 for(const sharp of SHARP_BOOKS){
  const selected=rows.filter(x=>norm(x.book)===sharp||norm(x.book).includes(sharp));
  const complete=bestPerOutcome(selected,expected);
  if(complete.length!==expected.length)continue;
  const fair=powerDevig(complete.map(x=>x.impliedProbability));
  return {
   probabilities:new Map(expected.map((key,i)=>[key,fair[i]])),
   reference:'Pinnacle/sharp',
   books:[...new Set(complete.map(x=>x.book))]
  };
 }
 return null;
}

function consensusReference(rows:Quote[],expected:string[]){
 const books=new Set(rows.map(x=>norm(x.book)).filter(Boolean));
 if(books.size<2)return null;

 const raw=expected.map(outcome=>{
  const selected=rows.filter(x=>x.outcomeKey===outcome);
  return selected.reduce((s,x)=>s+x.impliedProbability,0)/Math.max(1,selected.length);
 });
 const fair=powerDevig(raw);
 return {
  probabilities:new Map(expected.map((key,i)=>[key,fair[i]])),
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
 const maxArbRoi=clamp(Number(process.env.EDGE_SCANNER_MAX_ARB_ROI||.15),.01,.50);
 const maxEv=clamp(Number(process.env.EDGE_SCANNER_MAX_EV||.35),.05,1);

 const quotes=panelMarkets.map(parseQuote).filter((x):x is Quote=>Boolean(x));
 const groups=new Map<string,Quote[]>();
 for(const quote of quotes){
  const list=groups.get(quote.groupKey)||[];
  list.push(quote);
  groups.set(quote.groupKey,list);
 }

 const arbitrage:ArbitrageOpportunity[]=[];
 const positiveEv:PositiveEvOpportunity[]=[];
 let sharpReferenceGroups=0;
 let consensusReferenceGroups=0;
 let rejectedSuspiciousArbitrage=0;
 let rejectedSuspiciousEv=0;

 for(const [key,rows] of groups){
  const expected=completeGroup(rows);
  if(!expected)continue;

  const best=bestPerOutcome(rows,expected);
  if(best.length===expected.length){
   const inverse=best.map(x=>1/x.decimal);
   const sum=inverse.reduce((s,x)=>s+x,0);
   if(sum>0&&sum<.9995){
    const roi=1/sum-1;
    if(roi<=maxArbRoi){
     arbitrage.push({
      key,
      sport:rows[0].sport,
      league:rows[0].league,
      event:rows[0].event,
      market:rows[0].market,
      startTime:rows[0].startTime,
      outcomeCount:best.length,
      impliedProbabilitySum:sum,
      roi,
      stakePlan:best.map((x,i)=>({
       selection:x.selection,
       book:x.book,
       odds:x.odds,
       stakeFraction:inverse[i]/sum,
       payoutMultiple:1/sum
      }))
     });
    }else{
     rejectedSuspiciousArbitrage++;
    }
   }
  }

  const reference=sharpReference(rows,expected)||consensusReference(rows,expected);
  if(!reference)continue;
  if(reference.reference==='Pinnacle/sharp')sharpReferenceGroups++;
  else consensusReferenceGroups++;

  for(const outcome of expected){
   const fairP=reference.probabilities.get(outcome);
   if(!fairP)continue;
   const candidates=rows.filter(x=>x.outcomeKey===outcome);
   const bestQuote=[...candidates].sort((a,b)=>b.decimal-a.decimal)[0];
   if(!bestQuote)continue;

   const expectedValue=ev(fairP,bestQuote.odds);
   if(expectedValue<minEv)continue;
   if(expectedValue>maxEv){
    rejectedSuspiciousEv++;
    continue;
   }

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
    expectedValue,
    fullKelly,
    fractionalKelly:fullKelly*kellyFraction,
    reference:reference.reference,
    referenceBooks:reference.books
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
  rejectedSuspiciousArbitrage,
  rejectedSuspiciousEv,
  arbitrage:arbitrage.slice(0,options.maxArbitrage??25),
  positiveEv:positiveEv.slice(0,options.maxPositiveEv??50),
  methodology:{
   arbitrage:'validated complete team moneyline, total, and spread outcome sets only',
   devig:'power-method devig with complete sharp reference when available; multi-book consensus fallback otherwise',
   expectedValue:'fair probability versus best available price with anomaly caps',
   kellyFraction,
   extraProviderRequests:0,
   playerProps:'temporarily excluded from the edge scanner until player-side normalization is separately certified'
  }
 };
}
