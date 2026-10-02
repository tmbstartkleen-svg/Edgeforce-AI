import type {Market} from './types';
import {impliedProbability} from './math';

const clean=(v:string|undefined)=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');

function groupPoint(m:Market){
  if(typeof m.point!=='number')return '';
  const name=clean(m.market);
  if(name.includes('spread')||name.includes('run line')||name.includes('puck line'))return String(Math.abs(m.point));
  return String(m.point);
}

export function noVigGroupKey(m:Market){
  return [
    m.eventId||m.event,
    clean(m.bookmaker||'DraftKings'),
    clean(m.market),
    clean(m.player),
    clean(m.prop),
    groupPoint(m),
    clean(m.periodLabel)
  ].join('|');
}

export function applyNoVig(markets:Market[]):Market[]{
  const groups=new Map<string,Market[]>();
  for(const market of markets){
    const key=noVigGroupKey(market);
    groups.set(key,[...(groups.get(key)||[]),market]);
  }

  return markets.map(market=>{
    const raw=market.rawImpliedProb??impliedProbability(market.odds);
    const peers=groups.get(noVigGroupKey(market))||[];
    const probabilities=peers.map(x=>x.rawImpliedProb??impliedProbability(x.odds)).filter(Number.isFinite);
    const overround=probabilities.reduce((sum,p)=>sum+p,0);
    const complete=probabilities.length>=2&&overround>.98;
    const fair=complete?raw/overround:raw;
    return {
      ...market,
      rawImpliedProb:raw,
      noVigProb:complete?fair:undefined,
      marketProb:fair,
      modelProb:market.modelProb===market.marketProb||!Number.isFinite(market.modelProb)?fair:market.modelProb,
      vigPercent:complete?Math.max(0,overround-1):undefined,
      vigStatus:complete?'complete':'incomplete'
    };
  });
}
