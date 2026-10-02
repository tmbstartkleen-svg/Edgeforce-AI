import type {Market} from './types';

export type FeedIntegrityStatus='TRUSTED'|'DEGRADED'|'BLOCKED';

export type FeedIntegrity={
  status:FeedIntegrityStatus;
  officialEligible:boolean;
  source:string;
  mode:string;
  totalMarkets:number;
  acceptedMarkets:number;
  rejectedMarkets:number;
  rejectedStale:number;
  rejectedInvalid:number;
  rejectedConflicts:number;
  maxSourceAgeMin:number;
  conflictRate:number;
  validationCompared:number;
  validationConflicts:number;
  reconciliationCoverage:number;
  reasons:string[];
};

export type FeedIntegrityResult={
  integrity:FeedIntegrity;
  markets:Market[];
};

const envNum=(name:string,fallback:number)=>{
  const n=Number(process.env[name]);
  return Number.isFinite(n)?n:fallback;
};

function validMarket(m:Market,now:number){
  const start=new Date(m.startTime).getTime();
  const probability=m.rawImpliedProb??m.marketProb;
  if(!Number.isFinite(start))return false;
  if(start<now-2*3600000)return false;
  if(!Number.isFinite(m.odds)||m.odds===0)return false;
  if(!m.selection||!m.event||!m.sport)return false;
  if(typeof probability!=='number'||!Number.isFinite(probability)||probability<=0||probability>=1)return false;
  if(m.bookmaker&&m.bookmaker.toLowerCase()!=='draftkings')return false;
  return true;
}

export function assessFeedIntegrity(
  markets:Market[],
  source:string,
  mode:string,
  validation?:{enabled:boolean;compared:number;conflicts:number}
):FeedIntegrityResult{
  const now=Date.now();
  const liveMaxAge=envNum('LIVE_MARKET_MAX_AGE_MIN',12);
  const storedMaxAge=envNum('STORED_MARKET_MAX_AGE_MIN',20);
  const conflictThreshold=envNum('ODDS_VALIDATION_THRESHOLD',.035);
  const maxConflictRate=envNum('MAX_PROVIDER_CONFLICT_RATE',.20);
  const minimumMarkets=Math.max(1,Math.round(envNum('MIN_OFFICIAL_MARKETS',2)));
  const strictReconciliation=process.env.STRICT_PROVIDER_RECONCILIATION!=='false';
  const minReconciliationCoverage=Math.max(0,Math.min(1,envNum('MIN_RECONCILIATION_COVERAGE',.10)));
  const maxAge=source==='live'?liveMaxAge:storedMaxAge;

  let rejectedStale=0,rejectedInvalid=0,rejectedConflicts=0;
  const accepted:Market[]=[];

  for(const market of markets){
    if(!validMarket(market,now)){rejectedInvalid++;continue}
    if(!Number.isFinite(market.sourceAgeMin)||market.sourceAgeMin>maxAge){rejectedStale++;continue}
    if(strictReconciliation&&typeof market.validationGap==='number'&&market.validationGap>conflictThreshold){
      rejectedConflicts++;continue;
    }
    accepted.push(market);
  }

  const compared=validation?.compared||0;
  const conflicts=validation?.conflicts||0;
  const conflictRate=compared>0?conflicts/compared:0;
  const reconciliationCoverage=markets.length?compared/markets.length:0;
  const maxSourceAgeMin=accepted.length?Math.max(...accepted.map(x=>x.sourceAgeMin)):0;
  const reasons:string[]=[];

  if(source!=='live'||mode!=='live')reasons.push('Official board requires a live provider feed');
  if(rejectedStale)reasons.push(rejectedStale+' stale market'+(rejectedStale===1?' was':'s were')+' rejected');
  if(rejectedInvalid)reasons.push(rejectedInvalid+' invalid market'+(rejectedInvalid===1?' was':'s were')+' rejected');
  if(rejectedConflicts)reasons.push(rejectedConflicts+' provider-conflict market'+(rejectedConflicts===1?' was':'s were')+' rejected');
  if(compared>0&&conflictRate>maxConflictRate)reasons.push('Cross-provider conflict rate exceeded the production threshold');
  if(strictReconciliation&&validation?.enabled&&compared===0)reasons.push('Cross-provider validation was enabled but produced no comparable lines');
  if(strictReconciliation&&validation?.enabled&&reconciliationCoverage<minReconciliationCoverage)reasons.push('Cross-provider reconciliation coverage is below the production threshold');
  if(accepted.length<minimumMarkets)reasons.push('Too few fresh valid markets remain for the official board');
  if(!reasons.length)reasons.push('Live feed passed freshness, validity and reconciliation checks');

  const officialEligible=
    source==='live'&&mode==='live'&&
    accepted.length>=minimumMarkets&&
    (compared===0||conflictRate<=maxConflictRate)&&
    (!strictReconciliation||!validation?.enabled||(compared>0&&reconciliationCoverage>=minReconciliationCoverage));

  const status:FeedIntegrityStatus=officialEligible
    ?((rejectedStale||rejectedInvalid||rejectedConflicts||conflictRate>0)?'DEGRADED':'TRUSTED')
    :'BLOCKED';

  return {
    markets:accepted,
    integrity:{
      status,officialEligible,source,mode,totalMarkets:markets.length,acceptedMarkets:accepted.length,
      rejectedMarkets:markets.length-accepted.length,rejectedStale,rejectedInvalid,rejectedConflicts,
      maxSourceAgeMin,conflictRate,validationCompared:compared,validationConflicts:conflicts,reconciliationCoverage,reasons
    }
  };
}

export function officialScannedEligible<T extends {
  sourceAgeMin:number;
  simulationMode:string;
  simProbability:number;
  grade:string;
  validationGap?:number;
  dataQuality?:number|unknown;
}>(rows:T[]){
  const liveMaxAge=envNum('LIVE_MARKET_MAX_AGE_MIN',12);
  const conflictThreshold=envNum('ODDS_VALIDATION_THRESHOLD',.035);
  return rows.filter(row=>{
    if(row.simulationMode==='probability-fallback'||row.grade==='PASS'||row.simProbability<.65)return false;
    if(!Number.isFinite(row.sourceAgeMin)||row.sourceAgeMin>liveMaxAge)return false;
    if(typeof row.validationGap==='number'&&row.validationGap>conflictThreshold)return false;
    if(typeof row.dataQuality==='number'&&row.dataQuality<envNum('MIN_MARKET_DATA_QUALITY',.55))return false;
    return true;
  });
}
