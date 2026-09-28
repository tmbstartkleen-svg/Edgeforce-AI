import type {Market} from './types';

export type InjurySignal={status:'ACTIVE'|'QUESTIONABLE'|'OUT'|'UNKNOWN';impact:number};
export type WeatherSignal={windMph:number;precipProb:number;tempF:number;indoor?:boolean};
export type RepriceContext={injury?:InjurySignal;weather?:WeatherSignal;homeAdvantage?:number;lineMovePct?:number};

export function repriceMarket(m:Market,ctx:RepriceContext):Market{
 let p=m.modelProb;
 if(ctx.injury){
  if(ctx.injury.status==='OUT') p-=Math.abs(ctx.injury.impact);
  if(ctx.injury.status==='QUESTIONABLE') p-=Math.abs(ctx.injury.impact)*.45;
 }
 if(ctx.weather&&!ctx.weather.indoor){
  if(ctx.weather.windMph>=20&&/passing|receiving|field goal/i.test(m.selection)) p-=.035;
  if(ctx.weather.precipProb>=.6&&/passing|receiving/i.test(m.selection)) p-=.02;
  if(ctx.weather.tempF<=20&&/passing|receiving/i.test(m.selection)) p-=.012;
 }
 if(typeof ctx.homeAdvantage==='number') p+=ctx.homeAdvantage;
 if(typeof ctx.lineMovePct==='number') p+=Math.max(-.025,Math.min(.025,ctx.lineMovePct*.15));
 return {...m,modelProb:Math.max(.01,Math.min(.99,p))};
}
