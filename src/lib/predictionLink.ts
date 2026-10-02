import type {Market} from './types';
import type {PredictionContract} from './predictionMarkets';

const norm=(v:string|undefined)=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function attachPredictionProbabilities(markets:Market[],contracts:PredictionContract[]){
  if(!contracts.length)return markets;
  return markets.map(m=>{
    const exact=contracts.find(c=>c.eventId&&m.eventId&&c.eventId===m.eventId&&norm(c.selection)===norm(m.selection));
    const fuzzy=exact||contracts.find(c=>{
      const title=norm(c.title),event=norm(m.event),selection=norm(m.selection);
      return Boolean(event&&selection&&title.includes(event)&&title.includes(selection));
    });
    if(!fuzzy)return m;
    const liquid=fuzzy.volume===undefined||fuzzy.volume>=Math.max(0,Number(process.env.PREDICTION_MIN_VOLUME)||1000);
    return liquid?{...m,predictionProb:fuzzy.yesProbability,predictionLiquidity:fuzzy.volume,predictionSource:fuzzy.source}:m;
  });
}
