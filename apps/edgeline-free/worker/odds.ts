import { normalizeFeed } from '../backend/normalize-odds';
import { scanArbitrage } from '../lib/arbitrage';
import { isFreshPrice } from '../lib/market-integrity';
const MONTH_LIMIT=300, DAILY_LIMIT=3, COST=3, COOLDOWN=30*60*1000;
export class FreeOdds {
 constructor(private ctx:any,private env:any) { ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)'); }
 read(key:string):any { const row=[...this.ctx.storage.sql.exec('SELECT value FROM state WHERE key = ?',key)][0];return row?JSON.parse(row.value):null; }
 write(key:string,value:any){this.ctx.storage.sql.exec('INSERT OR REPLACE INTO state (key,value) VALUES (?,?)',key,JSON.stringify(value));}
 async fetch(request:Request) {return this.ctx.blockConcurrencyWhile(async()=>{
  const url=new URL(request.url),now=Date.now(),day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7);
  let budget=this.read('budget')||{month,used:0,day,calls:0,last:0,remaining:null};
  if(budget.month!==month){budget.month=month;budget.used=0;}
  if(budget.day!==day){budget.day=day;budget.calls=0;}
  const sport=url.searchParams.get('sport')||this.read('lastSport')||'upcoming';
  let displayedSport=sport;
  let cached=this.read('feed:'+sport),problem:string|null=null,message:string|null=null;
  let catalog=this.read('catalog');
  const headers={'Cache-Control':'no-store'};
  if(url.pathname==='/budget')return Response.json({...budget,monthlyLimit:MONTH_LIMIT,dailyLimit:DAILY_LIMIT,cooldownMinutes:30},{headers});
  const force=url.pathname==='/refresh';
  const needRefresh=force||((!cached || now-Date.parse(cached.fetchedAt)>6*3600000) && url.pathname==='/state');
  // Reading cached data does not spend provider credits. Catalog requests are free.
  const allowed=this.env.FREE_ODDS_ENABLED==='true' && !!this.env.THE_ODDS_API_KEY;
  const quotaOK=budget.used+COST<=MONTH_LIMIT && budget.calls<DAILY_LIMIT && now-budget.last>=COOLDOWN;
  if(allowed && ((!catalog || now-catalog.at>86400000) || (needRefresh&&quotaOK))) {
   try {
    const r=await fetch('https://api.the-odds-api.com/v4/sports?apiKey='+encodeURIComponent(this.env.THE_ODDS_API_KEY),{signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error(r.status===401?'Provider rejected credential':`Provider catalog unavailable (${r.status})`);
    const rows:any=await r.json(); if(!Array.isArray(rows))throw new Error('Invalid sports catalog');
    const remaining=r.headers.get('x-requests-remaining');budget.remaining=remaining!==null&&Number.isFinite(Number(remaining))?Number(remaining):null;
    catalog={at:now,rows:rows.filter((s:any)=>s&&s.active&&!s.has_outrights&&/^[a-z0-9_]+$/.test(s.key)).map((s:any)=>({key:s.key,title:s.title,group:s.group}))};this.write('catalog',catalog);this.write('budget',budget);
   }catch(e){problem=e instanceof Error?e.message:'Catalog unavailable';}
  }
  if(url.pathname==='/sports')return Response.json({sports:catalog?.rows||[],problem},{headers});
  if(sport!=='upcoming'&&!catalog?.rows.some((s:any)=>s.key===sport))return Response.json({error:'Select an active provider league'},{status:400,headers});
  if(needRefresh) {
   if(!allowed)problem='Free odds credential or feed is not configured';
   else if(!quotaOK)message=budget.calls>=DAILY_LIMIT?'Daily free refresh limit reached':budget.used+COST>MONTH_LIMIT?'Monthly app credit limit reached':'Shared refresh cooldown active';
   else if(!problem && (budget.remaining===null || budget.remaining<COST+10))problem='Provider quota could not be verified or the 10-credit reserve was reached';
   else if(!problem){
    // Reserve before any network call. A crash or failure never refunds credits.
    budget={...budget,used:budget.used+COST,calls:budget.calls+1,last:now};this.write('budget',budget);
    try {
     const q=new URLSearchParams({apiKey:this.env.THE_ODDS_API_KEY,bookmakers:'draftkings,fanduel,betmgm,betrivers,betonlineag',markets:'h2h,spreads,totals',oddsFormat:'american'});
     const r=await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?${q}`,{signal:AbortSignal.timeout(12000)});
     const remaining=r.headers.get('x-requests-remaining');budget.remaining=remaining!==null&&Number.isFinite(Number(remaining))?Number(remaining):null;this.write('budget',budget);
     if(!r.ok)throw new Error(r.status===401?'Provider rejected credential':`Odds source unavailable (${r.status})`);
     const raw:any=await r.json();if(!Array.isArray(raw)||JSON.stringify(raw).length>1500000)throw new Error('Unexpected odds payload');
     cached={raw,fetchedAt:new Date().toISOString()};this.write('feed:'+sport,cached);this.write('feedIndex',[...new Set([...(this.read('feedIndex')||[]),sport])].slice(-100));this.write('lastSport',sport);message='Real provider snapshot refreshed within the free budget';
    }catch(e){problem=e instanceof Error?e.message:'Odds request failed';}
   }
  }
  if(!cached){const previous=this.read('lastSport');const saved=previous?this.read('feed:'+previous):null;if(saved){cached=saved;displayedSport=previous;message=(message||problem||'Refresh unavailable')+'. Showing the previous '+previous+' snapshot.';}else if(!problem)problem='No snapshot for this league yet. Refresh when the shared budget allows.';}
  const snapshots=[...(this.read('feedIndex')||[]).map((key:string)=>this.read('feed:'+key)).filter(Boolean),cached].filter(Boolean).sort((a:any,b:any)=>Date.parse(a.fetchedAt)-Date.parse(b.fetchedAt));
  const merged=new Map<string,any>();for(const snapshot of snapshots)for(const event of snapshot.raw||[])if(event?.id)merged.set(event.id,event);
  const combined=[...merged.values()];
  const normalized=normalizeFeed(combined);
  const events=normalized.events.filter(e=>Date.parse(e.startsAt)>now&&Date.parse(e.startsAt)<now+7*86400000).map(e=>({...e,matchup:`${e.away} at ${e.home}`,markets:normalized.quotes.filter(q=>q.eventId===e.id).length}));
  const ids=new Set(events.map(e=>e.id));const quotes=normalized.quotes.filter(q=>ids.has(q.eventId)).map(q=>({...q,stale:!isFreshPrice(q.updatedAt,now)}));
  return Response.json({events,quotes,arbitrage:scanArbitrage(combined,now),feed:{sport:displayedSport,fetchedAt:cached?.fetchedAt||null,nextCheckAt:new Date(Math.max(budget.last+COOLDOWN,budget.calls>=DAILY_LIMIT?Date.parse(day)+86400000:now)).toISOString(),remaining:budget.remaining,problem,refreshMessage:message,manualRefreshesRemaining:Math.max(0,DAILY_LIMIT-budget.calls),creditsReserved:budget.used,monthlyLimit:MONTH_LIMIT},readiness:{prices:quotes.some(q=>!q.stale),simulations:quotes.some(q=>!q.stale),injuries:false,playerModels:false},generatedAt:new Date(now).toISOString()},{headers});
 });}
}
