import {db} from '@/lib/db';
import type {StoredGameQuote} from '@/lib/gameQuoteOverlay';

export const dynamic='force-dynamic';
type StoredRow={
 sport:string;home:string;away:string;startTime:Date|string;selection:string;market:string;
 odds:number;bookmaker:string;sourceTimestamp:string|null;pulledAt:Date|string;
 storedSourceAgeMin:string|null;liveEligible:string|null;
};
const MAX_ROWS=900;
const ttlMs=60000;
let cache:{at:number;value:unknown}|null=null;
async function load(){
 const sql=db();
 if(!sql)return {ok:false,status:'NO_SHARED_DATABASE',quotes:[],considered:0,
  warning:'Stored sportsbook market database not configured; schedule odds remain independent.'};
 const rows=await sql<StoredRow[]>`
  select e.sport,e.home_team_id as home,e.away_team_id as away,e.start_time as "startTime",
    ms.selection_key as selection,ms.market_key as market,ms.american_odds as odds,
    coalesce(nullif(ms.raw->>'sourceBook',''),ms.bookmaker) as bookmaker,
    nullif(ms.raw->>'sourceTimestamp','') as "sourceTimestamp",
    ms.pulled_at as "pulledAt",
    ms.raw->>'sourceAgeMin' as "storedSourceAgeMin",
    ms.raw->>'liveEligible' as "liveEligible"
  from market_snapshots ms
  join events e on e.id=ms.event_id
  where e.start_time>now() and e.start_time<now()+interval '8 days'
   and ms.pulled_at>now()-interval '30 minutes'
  order by ms.pulled_at desc
  limit ${MAX_ROWS}
 `;
 const now=Date.now();
 const seen=new Set<string>();
 const quotes:StoredGameQuote[]=[];
 let missingTimestamp=0,stale=0;
 for(const row of rows){
  const start=new Date(row.startTime).toISOString();
  const at=row.sourceTimestamp;
  const stamp=at?Date.parse(at):NaN;
  const received=Date.parse(String(row.pulledAt));
  const originalAge=Number(row.storedSourceAgeMin);
  const age=Number.isFinite(stamp)&&Number.isFinite(received)?
   Math.max((now-stamp)/60000,(now-received)/60000,
    row.storedSourceAgeMin===null?0:(Number.isFinite(originalAge)?originalAge:Number.POSITIVE_INFINITY))
   :Number.POSITIVE_INFINITY;
  if(!Number.isFinite(stamp))missingTimestamp++;
  if(age>10)stale++;
  const q:StoredGameQuote={
   sport:row.sport,home:row.home,away:row.away,startTime:start,selection:row.selection,
   market:row.market,odds:Number(row.odds),bookmaker:row.bookmaker,
   sourceTimestamp:at||'',ageMinutes:age,liveEligible:row.liveEligible!=='false'
  };
  const identity=[q.sport,q.home,q.away,q.startTime,q.selection,q.market,q.bookmaker].join('|').toLowerCase();
  if(seen.has(identity))continue;
  seen.add(identity);
  quotes.push(q);
 }
 return {ok:true,status:'READ_ONLY_STORED_MARKETS',quotes,considered:rows.length,
  truncated:rows.length>=MAX_ROWS,stale,missingTimestamp,generatedAt:new Date(now).toISOString(),
  warning:'Stored market history is not an executable quote; displayed market lines must match game and be under 10 minutes old.'};
}
export async function GET(){
 const now=Date.now();
 if(cache&&now-cache.at<ttlMs)return Response.json(cache.value,{headers:{'Cache-Control':'private, no-store'}});
 // Never share an in-flight PostgreSQL promise between request-scoped Cloudflare contexts.
 // Await this scoped read to completion; failures do not trigger new provider calls.
 try{
  const response=await load();
  cache={at:Date.now(),value:response};
  return Response.json(response,{headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return Response.json({ok:false,status:'STORED_ODDS_UNAVAILABLE',quotes:[],
   warning:'Read-only market snapshots unavailable. No additional sportsbook polling was attempted.'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
