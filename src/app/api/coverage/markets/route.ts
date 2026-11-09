import {ingestOdds} from '@/lib/providers/ingest';
export const dynamic='force-dynamic';
const MAX_AGE_MIN=15;
export async function GET(){
 try{
  const result=await ingestOdds();
  const rows=Array.isArray(result.markets)?result.markets:[];
  const accepted=rows.filter(m=>{
   const age=Number(m.sourceAgeMin);
   const book=String(m.sourceBook||'').trim();
   return result.mode==='live'&&result.source==='live'&&book.length>0&&book.toLowerCase()!=='unknown'&&
    !!m.id&&!!m.event&&!!m.market&&!!m.selection&&Number.isFinite(m.odds)&&m.odds!==0&&
    Number.isFinite(age)&&age>=0&&age<=MAX_AGE_MIN&&
    !!m.sourceTimestamp&&!Number.isNaN(Date.parse(m.sourceTimestamp))&&
    Date.parse(m.sourceTimestamp)<=Date.now()+60000;
  });
  const byLeague=Object.values(accepted.reduce((acc,m)=>{
    const key=(m.league||'Unmapped').trim()||'Unmapped';
    const x=acc[key]??{league:key,quotes:0,events:new Set<string>(),books:new Set<string>(),marketTypes:new Set<string>(),lastObservedAt:''};
    x.quotes++;x.events.add(m.event);x.books.add(String(m.sourceBook));x.marketTypes.add(m.market);
    if(String(m.sourceTimestamp)>x.lastObservedAt)x.lastObservedAt=String(m.sourceTimestamp);
    acc[key]=x;return acc;
  },{} as Record<string,{league:string;quotes:number;events:Set<string>;books:Set<string>;marketTypes:Set<string>;lastObservedAt:string}>)).map(x=>({
   league:x.league,quotes:x.quotes,events:x.events.size,bookmakers:[...x.books].sort(),
   marketTypes:[...x.marketTypes].sort(),lastObservedAt:x.lastObservedAt
  })).sort((a,b)=>b.quotes-a.quotes);
  return Response.json({ok:true,generatedAt:new Date().toISOString(),verification:'SINGLE_BOOK_TIMESTAMPED_SNAPSHOTS',
    cutoffMinutes:MAX_AGE_MIN,source:result.source,mode:result.mode,
    totalReceived:rows.length,verifiedQuotes:accepted.length,excludedQuotes:rows.length-accepted.length,
    bookmakers:[...new Set(accepted.map(m=>String(m.sourceBook)))].sort(),
    byLeague,independentUpstreamsVerified:false,crossBookConsensusVerified:false,
    warnings:[...(result.warnings||[]).slice(0,5),'Timestamped quotes do not prove independent upstreams or cross-book consensus.'],
    certification:'PROVISIONAL'});
 }catch(e){return Response.json({ok:false,generatedAt:new Date().toISOString(),verification:'UNAVAILABLE',
   verifiedQuotes:0,byLeague:[],bookmakers:[],error:e instanceof Error?e.message:'Market evidence unavailable'},
   {status:503,headers:{'Cache-Control':'no-store'}});}
}
