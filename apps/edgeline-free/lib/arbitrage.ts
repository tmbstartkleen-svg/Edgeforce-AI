import { isFreshPrice, decimalPrice } from './market-integrity';
export type Arb = {eventId:string; startsAt:string; matchup:string; market:string; margin:number; legs:{book:string;selection:string;price:number;share:number;updatedAt:string}[]};
// Only same-event, full-match, moneyline markets. Spreads/totals and exchange
// contracts are excluded until their settlement and fee rules are matched.
export function scanArbitrage(events:any[], now=Date.now()):Arb[] {
 const found:Arb[]=[];
 for(const e of events) {
  if(!e || !e.id || !e.home_team || !e.away_team || Date.parse(e.commence_time)<=now || !Number.isFinite(Date.parse(e.commence_time))) continue;
  if(!Array.isArray(e.bookmakers))continue;
  const valid=e.bookmakers.filter((b:any)=>b&&Array.isArray(b.markets)&&['draftkings','fanduel'].includes(b.key)).flatMap((b:any)=>{
   const m=b.markets.find((x:any)=>x&&x.key==='h2h'); if(!m || !Array.isArray(m.outcomes) || !isFreshPrice(m.last_update||b.last_update,now))return [];
   const names=m.outcomes?.map((o:any)=>o?.name);
   if(!names || new Set(names).size!==names.length || !names.includes(e.home_team)||!names.includes(e.away_team)|| names.some((n:string)=>![e.home_team,e.away_team,'Draw'].includes(n)) || ![2,3].includes(names.length)) return [];
   if(m.outcomes.some((o:any)=>typeof o.price!=='number'||!Number.isFinite(o.price)||Math.abs(o.price)<100))return [];
   return [{book:b.key,updatedAt:m.last_update||b.last_update,outcomes:m.outcomes,names:names.slice().sort().join('|')}];
  });
  if(valid.length<2 || new Set(valid.map((b:any)=>b.names)).size!==1)continue;
  const legs=valid[0].outcomes.map((o:any)=>{
   const best=valid.map((b:any)=>({book:b.book,updatedAt:b.updatedAt,selection:o.name,price:b.outcomes.find((x:any)=>x.name===o.name).price})).sort((a:any,b:any)=>decimalPrice(b.price)-decimalPrice(a.price))[0];return best;
  });
  const sum=legs.reduce((v:number,l:any)=>v+1/decimalPrice(l.price),0);
  if(sum>=1 || new Set(legs.map((l:any)=>l.book)).size<2)continue;
  found.push({eventId:e.id,startsAt:e.commence_time,matchup:`${e.away_team} at ${e.home_team}`,market:'Full-game moneyline · rules confirmation required',margin:(1/sum-1)*100,legs:legs.map((l:any)=>({...l,share:(1/decimalPrice(l.price))/sum}))});
 }
 return found.sort((a,b)=>b.margin-a.margin);
}
