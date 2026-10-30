import {isFreshPrice,decimalPrice} from './market-integrity';
import {rollingSequences} from './decision-math';
export function opportunities(data:any,now:number){
 const events=new Map((data?.events||[]).filter((e:any)=>Date.parse(e.startsAt)>now).map((e:any)=>[e.id,e]));
 const edges=(data?.quotes||[]).filter((q:any)=>events.has(q.eventId)&&isFreshPrice(q.updatedAt,now)&&q.consensusBooks>=2&&(q.bookPrices||[]).filter((b:any)=>b.book!=='draftkings').length>=2&&(q.bookPrices||[]).every((b:any)=>isFreshPrice(b.updatedAt,now))&&Number.isFinite(q.consensusProbability)&&q.consensusProbability>0&&q.consensusProbability<100&&decimalPrice(q.price)>1).map((q:any)=>({...q,ev:(q.consensusProbability/100*decimalPrice(q.price)-1)*100})).filter((q:any)=>q.ev>0).sort((a:any,b:any)=>b.ev-a.ev);
 const arbs=(data?.arbitrage||[]).filter((a:any)=>events.has(a.eventId)&&a.legs.every((l:any)=>isFreshPrice(l.updatedAt,now)));
 const daily=rollingSequences(data?.quotes||[],data?.events||[],now,24);
 const weekly=rollingSequences(data?.quotes||[],data?.events||[],now,168).filter(legs=>legs.some(q=>Date.parse((events.get(q.eventId) as any)?.startsAt)+4*3600000>now+24*3600000));
 const tags:Record<string,string[]>={};const add=(id:string,tag:string)=>{tags[id]||=[];if(!tags[id].includes(tag))tags[id].push(tag);};
 edges.forEach((q:any)=>add(q.eventId,'Market EV'));arbs.forEach((a:any)=>add(a.eventId,'Arb'));daily.flat().forEach(q=>add(q.eventId,'Daily parlay'));weekly.flat().forEach(q=>add(q.eventId,'Weekly parlay'));
 return {edges,arbs,daily,weekly,tags,events:(data?.events||[]).filter((e:any)=>tags[e.id]).map((e:any)=>({...e,opportunityTags:tags[e.id]}))};
}
