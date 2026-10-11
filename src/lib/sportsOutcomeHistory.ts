import type {ScheduleGame} from './gameSchedule';

export type ObservedFinal={
 source:string;sourceEventKey:string;sport:string;league:string;
 homeName:string;awayName:string;scheduledAt:string;
 homeScore:number;awayScore:number;sourceObservedAt:null;
 verification:'SINGLE_SOURCE';
};
export type LicensedPlay={
 source:string;sourceEventKey:string;sourcePlayKey:string;sport:string;
 eventTime:string;observedAt:string|null;periodLabel:string|null;
 clockLabel:string|null;description:string;playerName:string|null;
 teamName:string|null;rawStats:Record<string,number|string|boolean|null>;
 verification:'DECLARED_SOURCE';
};
const safeName=(v:unknown,max=90)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
const score=(v:unknown)=>typeof v==='string'&&/^\d{1,5}$/.test(v)&&Number(v)<=10000?Number(v):null;
const iso=(v:unknown)=>{
 const ms=typeof v==='string'?Date.parse(v):NaN;
 return Number.isFinite(ms)?new Date(ms).toISOString():null;
};
export function normalizeFinals(games:readonly ScheduleGame[],source:string,feedLabel:string,now=Date.now()){
 const output:ObservedFinal[]=[];
 const seen=new Set<string>();
 let rejected=0;
 for(const game of games.slice(0,220)){
  const home=safeName(game.home),away=safeName(game.away);
  const start=iso(game.startTime),hs=score(game.homeScore),as=score(game.awayScore);
  const when=start?Date.parse(start):NaN;
  const valid=game.state==='post'&&game.sport===feedLabel&&
   game.id.startsWith(feedLabel+':')&&/^[a-zA-Z0-9_.:-]{4,130}$/.test(game.id)&&
   home.length>1&&away.length>1&&home.toLowerCase()!==away.toLowerCase()&&
   !['tbd','unknown'].includes(home.toLowerCase())&&!['tbd','unknown'].includes(away.toLowerCase())&&
   hs!==null&&as!==null&&start!==null&&when<=now&&now-when<=15*86400000;
  if(!valid){rejected++;continue}
  const id=game.id+':'+hs+':'+as;
  if(seen.has(id))continue;
  seen.add(id);
  output.push({source,sourceEventKey:game.id,sport:feedLabel,league:feedLabel,
   homeName:home,awayName:away,scheduledAt:start!,homeScore:hs!,awayScore:as!,
   sourceObservedAt:null,verification:'SINGLE_SOURCE'});
 }
 return {games:output,rejected,examined:Math.min(games.length,220),
  warning:'Score snapshots reflect one provider observation. No independent official-result certification is implied.'};
}
export function normalizeLicensedPlays(items:unknown,source:string,now=Date.now()){
 if(!Array.isArray(items)||items.length<1||items.length>30)return null;
 const out:LicensedPlay[]=[];const seen=new Set<string>();
 for(const item of items){
  if(!item||typeof item!=='object'||Array.isArray(item))return null;
  const p=item as Record<string,unknown>;
  const event=safeName(p.sourceEventKey,110),play=safeName(p.sourcePlayKey,110);
  const sport=safeName(p.sport,35),description=safeName(p.description,500);
  const timestamp=iso(p.eventTime),observed=p.observedAt===undefined||p.observedAt===null?null:iso(p.observedAt);
  const time=timestamp?Date.parse(timestamp):NaN;
  if(!/^[A-Za-z0-9._:-]{4,110}$/.test(event)||!/^[A-Za-z0-9._:-]{2,110}$/.test(play)||
   !/^[A-Za-z0-9 _-]{2,35}$/.test(sport)||description.length<4||
   !timestamp||time<Date.parse('1980-01-01T00:00:00Z')||time>now+86400000||
   (p.observedAt!==undefined&&p.observedAt!==null&&!observed)||
   (observed!==null&&Date.parse(observed)>now+60000))return null;
  const key=source+':'+event+':'+play;
  if(seen.has(key))return null;
  seen.add(key);
  const stats=p.rawStats===undefined?{}:p.rawStats;
  if(!stats||typeof stats!=='object'||Array.isArray(stats))return null;
  const entries=Object.entries(stats as Record<string,unknown>);
  if(entries.length>16)return null;
  const rawStats:LicensedPlay['rawStats']={};
  for(const [k,value]of entries){
   if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)||
    !(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=90||
     typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e7))return null;
   rawStats[k]=value as number|string|boolean|null;
  }
  out.push({source,sourceEventKey:event,sourcePlayKey:play,sport,eventTime:timestamp,
   observedAt:observed,periodLabel:safeName(p.periodLabel,40)||null,
   clockLabel:safeName(p.clockLabel,40)||null,description,
   playerName:safeName(p.playerName)||null,teamName:safeName(p.teamName)||null,
   rawStats,verification:'DECLARED_SOURCE'});
 }
 return out;
}
