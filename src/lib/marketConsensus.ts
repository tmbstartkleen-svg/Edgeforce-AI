import type {Market,MarketConsensus,MarketRole} from './types';
import {fairAmerican} from './math';

type Quote=Market & {
 sourceProviderId:string;
 marketRole:MarketRole;
 sourceProviderWeight:number;
};

export const normalizeConsensusText=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9.+-]+/g,' ').replace(/\s+/g,' ').trim();
const norm=normalizeConsensusText;
const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));

export function canonicalConsensusMarket(market:string){
 const value=norm(market);
 if(value==='h2h'||value==='ml'||value.includes('moneyline')||value.includes('money line'))return 'moneyline';
 if(value.includes('spread')||value.includes('run line')||value.includes('runline')||value.includes('puck line')||value.includes('handicap'))return 'spread';
 if(value.includes('total')||value==='totals')return 'total';
 return value;
}

export function canonicalConsensusSelection(selection:string){
 return norm(selection).replace(/\b(moneyline|money line|ml)\b/g,'').replace(/\s+/g,' ').trim();
}

export function consensusMarketKey(m:Market){
 return [
  norm(m.sport),
  norm(m.home),
  norm(m.away),
  canonicalConsensusMarket(m.market),
  canonicalConsensusSelection(m.selection),
  new Date(m.startTime).toISOString()
 ].join('|');
}

function weightedMedian(rows:Array<{p:number;weight:number}>){
 if(!rows.length)return .5;
 const sorted=[...rows].sort((a,b)=>a.p-b.p);
 const total=sorted.reduce((s,x)=>s+x.weight,0);
 let cumulative=0;
 for(const row of sorted){
  cumulative+=row.weight;
  if(cumulative>=total/2)return row.p;
 }
 return sorted[sorted.length-1].p;
}

function weightedMean(rows:Array<{p:number;weight:number}>){
 const total=rows.reduce((s,x)=>s+x.weight,0);
 return total?rows.reduce((s,x)=>s+x.p*x.weight,0)/total:.5;
}

function robustConsensus(rows:Array<{p:number;weight:number}>){
 const median=weightedMedian(rows);
 const deviations=rows.map(x=>Math.abs(x.p-median)).sort((a,b)=>a-b);
 const mad=deviations[Math.floor(deviations.length/2)]||0;
 const threshold=Math.max(.015,mad*3);
 const retained=rows.filter(x=>Math.abs(x.p-median)<=threshold);
 const used=retained.length>=2?retained:rows;
 return {probability:weightedMean(used),median,mad,threshold,retained:used.length};
}

function bestOdds(rows:Quote[]){
 return [...rows].sort((a,b)=>b.odds-a.odds)[0];
}

function collapseBooks(rows:Quote[]){
 const byBook=new Map<string,Quote>();
 for(const row of rows){
  const book=norm(row.sourceBook||row.sourceProviderId);
  const prior=byBook.get(book);
  if(!prior||row.sourceAgeMin<prior.sourceAgeMin||(row.sourceAgeMin===prior.sourceAgeMin&&row.sourceProviderWeight>prior.sourceProviderWeight)){
   byBook.set(book,row);
  }
 }
 return [...byBook.values()];
}

function roleProbability(rows:Quote[],role:MarketRole){
 const selected=rows.filter(x=>x.marketRole===role);
 if(!selected.length)return undefined;
 return weightedMean(selected.map(x=>({p:x.marketProb,weight:x.sourceProviderWeight})));
}

export function buildConsensusMarkets(quotes:Quote[],targetBook='DraftKings'){
 const groups=new Map<string,Quote[]>();
 for(const quote of quotes){
  const list=groups.get(consensusMarketKey(quote))||[];
  list.push(quote);groups.set(consensusMarketKey(quote),list);
 }
 const markets:Market[]=[];
 for(const group of groups.values()){
  const books=collapseBooks(group);
  if(!books.length)continue;
  const weighted=books.map(x=>({p:clamp(x.marketProb,.001,.999),weight:Math.max(.1,x.sourceProviderWeight)}));
  const robust=robustConsensus(weighted);
  const varianceRows=weighted.filter(x=>Math.abs(x.p-robust.probability)<=robust.threshold);
  const dispersionRows=varianceRows.length>=2?varianceRows:weighted;
  const variance=dispersionRows.reduce((s,x)=>s+x.weight*(x.p-robust.probability)**2,0)/Math.max(.1,dispersionRows.reduce((s,x)=>s+x.weight,0));
  const dispersion=Math.sqrt(variance);
  const agreement=clamp(1-dispersion/.10);
  const exactTarget=books.find(x=>norm(x.sourceBook||'')===norm(targetBook));
  const best=bestOdds(books);
  const target=exactTarget||books.find(x=>x.marketRole==='REFERENCE')||best;
  const sharpProbability=roleProbability(books,'SHARP');
  const publicProbability=roleProbability(books,'PUBLIC');
  const sharpPublicGap=sharpProbability!==undefined&&publicProbability!==undefined?sharpProbability-publicProbability:undefined;
  const marketStructure:MarketConsensus['marketStructure']=
   sharpPublicGap===undefined?'UNCLASSIFIED':
   Math.abs(sharpPublicGap)<.008?'ALIGNED':
   sharpPublicGap>=.025?'SHARP_OVER_PUBLIC':
   sharpPublicGap<=-.025?'PUBLIC_OVER_SHARP':'MIXED';
  const probs=books.map(x=>x.marketProb);
  const outlierBooks=books.filter(x=>Math.abs(x.marketProb-robust.probability)>Math.max(.025,dispersion*2.25)).map(x=>x.sourceBook||x.sourceProviderId);
  const consensus:MarketConsensus={
   providerCount:new Set(books.map(x=>x.sourceProviderId)).size,
   bookCount:books.length,
   targetBook,
   targetBookFound:Boolean(exactTarget),
   consensusProbability:robust.probability,
   consensusFairOdds:fairAmerican(robust.probability),
   dispersion,
   agreement,
   minProbability:Math.min(...probs),
   maxProbability:Math.max(...probs),
   bestOdds:best.odds,
   bestBook:best.sourceBook||best.sourceProviderId,
   sharpProbability,
   publicProbability,
   sharpPublicGap,
   marketStructure,
   outlierBooks,
   books:books.map(x=>x.sourceBook||x.sourceProviderId)
  };
  const sourceWasMarketBaseline=Math.abs(target.modelProb-target.marketProb)<.0005;
  markets.push({
   ...target,
   marketProb:robust.probability,
   modelProb:sourceWasMarketBaseline?robust.probability:target.modelProb,
   consensus,
   sourceBook:target.sourceBook||targetBook,
   confidence:clamp(target.confidence*(.82+.18*agreement),.2,.99)
  });
 }
 return markets;
}
