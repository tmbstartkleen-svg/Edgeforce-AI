import type {Market} from '../types';
import {applyNoVig} from '../noVig';
import {fetchNormalizedOdds} from './odds';
import {fetchSharpApiMarkets} from './sharpApi';
import {fetchTheOddsApiMarkets} from './theOddsApi';

export type V22OddsResult={
  mode:'live'|'unconfigured'|'failed';
  providerId?:string;
  providerName?:string;
  markets:Market[];
  rawCount:number;
  warnings:string[];
  attempts:Array<{providerId:string;ok:boolean;error?:string}>;
  validation?:{enabled:boolean;compared:number;conflicts:number};
  error?:string;
};

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const point=(m:Market)=>typeof m.point==='number'?Math.round(m.point*10)/10:null;
const matchKey=(m:Market)=>[norm(m.event),norm(m.market),norm(m.selection),point(m)].join('|');

function dedupe(rows:Market[]){
  const map=new Map<string,Market>();
  for(const row of rows){
    const key=[row.eventId||row.event,row.marketKey||row.market,row.selection,row.point??'',row.bookmaker||'DraftKings'].join('|');
    const previous=map.get(key);
    if(!previous||row.sourceAgeMin<previous.sourceAgeMin)map.set(key,row);
  }
  return [...map.values()];
}

function validate(primary:Market[],secondary:Market[]){
  const lookup=new Map(secondary.map(x=>[matchKey(x),x]));
  let compared=0,conflicts=0;
  const threshold=Math.max(.01,Number(process.env.ODDS_VALIDATION_THRESHOLD)||.035);
  const rows=primary.map(x=>{
    const other=lookup.get(matchKey(x));
    if(!other)return x;
    compared++;
    const gap=Math.abs((x.rawImpliedProb??x.marketProb)-(other.rawImpliedProb??other.marketProb));
    if(gap>threshold)conflicts++;
    return {...x,validationGap:gap,dataQuality:Math.max(.25,(x.dataQuality??1)-(gap>threshold?.25:0))};
  });
  return {rows,compared,conflicts};
}

export async function fetchV22Odds():Promise<V22OddsResult>{
  const attempts:V22OddsResult['attempts']=[];
  const sharp=await fetchSharpApiMarkets();
  attempts.push({providerId:'sharpapi',ok:sharp.ok,error:sharp.error});
  let markets:Market[]=[];
  let providerId='';
  let providerName='';
  let warnings=[...sharp.warnings];

  if(sharp.ok&&sharp.markets.length){
    markets=sharp.markets;
    providerId='sharpapi';
    providerName='SharpAPI / DraftKings';
  }else{
    const generic=await fetchNormalizedOdds();
    attempts.push({providerId:generic.providerId||'generic',ok:generic.mode==='live',error:generic.error});
    if(generic.mode==='live'&&generic.markets.length){
      markets=generic.markets.map((x:Market)=>({...x,provider:x.provider||generic.providerName||'Authorized Provider',bookmaker:x.bookmaker||'DraftKings'}));
      providerId=generic.providerId||'authorized-provider';
      providerName=generic.providerName||'Authorized Odds Provider';
      warnings.push(...generic.warnings);
    }else{
      const odds=await fetchTheOddsApiMarkets();
      attempts.push({providerId:'the-odds-api',ok:odds.ok,error:odds.error});
      warnings.push(...odds.warnings);
      if(odds.ok&&odds.markets.length){
        markets=odds.markets;
        providerId='the-odds-api';
        providerName='The Odds API / DraftKings';
      }
    }
  }

  if(!markets.length){
    const configured=Boolean(process.env.SHARP_API_KEY||process.env.THE_ODDS_API_KEY||process.env.ODDS_PROVIDER_PRIMARY_URL);
    return {mode:configured?'failed':'unconfigured',markets:[],rawCount:0,warnings,attempts,error:'No live DraftKings feed returned usable markets'};
  }

  markets=dedupe(markets);
  let validation:V22OddsResult['validation'];
  if(providerId==='sharpapi'&&process.env.ENABLE_ODDS_VALIDATION==='true'&&process.env.THE_ODDS_API_KEY){
    const secondary=await fetchTheOddsApiMarkets();
    attempts.push({providerId:'the-odds-api-validation',ok:secondary.ok,error:secondary.error});
    if(secondary.ok){
      const checked=validate(markets,secondary.markets);
      markets=checked.rows;
      validation={enabled:true,compared:checked.compared,conflicts:checked.conflicts};
      if(checked.conflicts)warnings.push(`${checked.conflicts} DraftKings lines differ materially between providers`);
    }else validation={enabled:true,compared:0,conflicts:0};
  }

  const normalized=applyNoVig(markets);
  return {mode:'live',providerId,providerName,markets:normalized,rawCount:normalized.length,warnings,attempts,validation};
}
