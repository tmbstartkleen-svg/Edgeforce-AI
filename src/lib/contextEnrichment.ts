import type {Market} from './types';
import {engineerFeatures,type HistoricalContext} from './featureEngineering';
import {fetchWeatherContext,fetchInjuryContext,fetchStatsContext} from './providers/context';

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):undefined;
const str=(v:unknown)=>typeof v==='string'?v:'';
const norm=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const clip=(x:number)=>Math.max(-1,Math.min(1,x));
const flag=(v:unknown)=>{
 if(typeof v==='boolean')return v?1:0;
 if(typeof v==='number'&&Number.isFinite(v))return v?1:0;
 if(typeof v==='string'){
  const x=v.trim().toLowerCase();
  if(['true','yes','confirmed','active','starting','available'].includes(x))return 1;
  if(['false','no','unconfirmed','inactive','out','unavailable'].includes(x))return 0;
 }
 return undefined;
};

function rows(payload:unknown):Record<string,unknown>[] {
 if(Array.isArray(payload))return payload.map(obj);
 const root=obj(payload);
 for(const k of ['data','results','events','items','games'])if(Array.isArray(root[k]))return (root[k] as unknown[]).map(obj);
 return [];
}
function eventKey(row:Record<string,unknown>){return str(row.event_id)||str(row.eventId)||str(row.id)||norm(str(row.event)||str(row.event_name))}
function marketKeys(m:Market){return [m.eventId||'',norm(m.event)].filter(Boolean)}
function index(payload:unknown){const map=new Map<string,Record<string,unknown>>();for(const r of rows(payload)){const k=eventKey(r);if(k)map.set(k,r)}return map}
function lookup(map:Map<string,Record<string,unknown>>,m:Market){for(const k of marketKeys(m)){const v=map.get(k);if(v)return v}return undefined}

function weatherSeverity(r:Record<string,unknown>|undefined){
 if(!r)return undefined;
 const direct=num(r.weather_severity??r.weatherSeverity);if(direct!==undefined)return clip(direct);
 const wind=num(r.wind_mph??r.windMph)??0,precip=num(r.precip_prob??r.precipitation_probability??r.precipProb)??0,temp=num(r.temp_f??r.temperature_f??r.temperature)??65;
 const windScore=Math.max(0,(wind-10)/25),precipScore=precip>1?precip/100:precip,tempScore=Math.max(0,(35-temp)/35,(temp-90)/25);
 return clip(windScore*.45+precipScore*.35+tempScore*.20);
}
function injuryImpact(r:Record<string,unknown>|undefined){
 if(!r)return undefined;
 const direct=num(r.injury_impact??r.injuryImpact??r.impact);if(direct!==undefined)return clip(direct);
 const out=num(r.out_count??r.out)??0,questionable=num(r.questionable_count??r.questionable)??0,doubtful=num(r.doubtful_count??r.doubtful)??0;
 return clip((out*.12+doubtful*.08+questionable*.035));
}
function statusFeatures(r:Record<string,unknown>|undefined){
 if(!r)return {} as Record<string,number>;
 const out:Record<string,number>={};
 const lineup=flag(r.lineup_confirmed??r.lineupConfirmed??r.confirmed_lineup);
 const starter=flag(r.starter_confirmed??r.starterConfirmed??r.confirmed_starter);
 const changed=flag(r.starter_changed??r.starterChanged??r.qb_changed??r.goalie_changed??r.pitcher_changed);
 const availability=num(r.availability_shock??r.availabilityShock??r.lineup_change_impact??r.lineupChangeImpact);
 if(lineup!==undefined)out.lineupConfirmed=lineup;
 if(starter!==undefined)out.starterConfirmed=starter;
 if(changed!==undefined)out.starterChanged=changed;
 if(availability!==undefined)out.availabilityShock=clip(availability);
 return out;
}

function statsContext(r:Record<string,unknown>|undefined):HistoricalContext{
 if(!r)return {};
 return {
  homeWinRate:num(r.home_win_rate??r.homeWinRate),awayWinRate:num(r.away_win_rate??r.awayWinRate),recentWinRate:num(r.recent_win_rate??r.recentWinRate),
  restDays:num(r.rest_days??r.restDays),travelMiles:num(r.travel_miles??r.travelMiles),paceIndex:num(r.pace_index??r.paceIndex),usageIndex:num(r.usage_index??r.usageIndex),
  matchupIndex:num(r.matchup_index??r.matchupIndex),efficiencyIndex:num(r.efficiency_index??r.efficiencyIndex),playerForm:num(r.player_form??r.playerForm??r.quarterback_edge??r.quarterbackEdge),
  starterEdge:num(r.starter_edge??r.starterEdge),bullpenEdge:num(r.bullpen_edge??r.bullpenEdge),goalieEdge:num(r.goalie_edge??r.goalieEdge),xgEdge:num(r.xg_edge??r.xgEdge),
  surfaceEdge:num(r.surface_edge??r.surfaceEdge),serveEdge:num(r.serve_edge??r.serveEdge),returnEdge:num(r.return_edge??r.returnEdge)
 };
}

export async function enrichMarketContext(markets:Market[]):Promise<{markets:Market[];status:{weather:boolean;injuries:boolean;stats:boolean}}>{
 const [weather,injuries,stats]=await Promise.all([
  fetchWeatherContext().catch(()=>({ok:false} as any)),fetchInjuryContext().catch(()=>({ok:false} as any)),fetchStatsContext().catch(()=>({ok:false} as any))
 ]);
 const wIndex=index(weather.ok?weather.data:undefined),iIndex=index(injuries.ok?injuries.data:undefined),sIndex=index(stats.ok?stats.data:undefined);
 const enriched=markets.map(m=>{
  const statsRow=lookup(sIndex,m);
  const s=statsContext(statsRow);
  const w=weatherSeverity(lookup(wIndex,m));if(w!==undefined)s.weatherSeverity=w;
  const inj=injuryImpact(lookup(iIndex,m));if(inj!==undefined)s.injuryImpact=inj;
  const engineered=engineerFeatures(m,s);
  const liveStatus=statusFeatures(statsRow);
  const contextCount=[lookup(wIndex,m),lookup(iIndex,m),statsRow].filter(Boolean).length;
  return {...m,sportFeatures:{...engineered,...(m.sportFeatures||{}),...liveStatus},dataQuality:Math.max(.35,Math.min(1,(m.dataQuality??.7)+contextCount*.08))};
 });
 return {markets:enriched,status:{weather:Boolean(weather.ok),injuries:Boolean(injuries.ok),stats:Boolean(stats.ok)}};
}
