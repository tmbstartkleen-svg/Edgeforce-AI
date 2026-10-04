import {ingestOdds} from '@/lib/providers/ingest';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

const norm=(value:string|undefined)=>String(value||'').trim().toLowerCase();

export async function GET(req:Request){
 try{
  const url=new URL(req.url);
  const forceLive=url.searchParams.get('refresh')==='1'||url.searchParams.get('refresh')==='true';
  const [odds,predictions]=await Promise.all([
   ingestOdds({forceLive}),
   fetchPredictionMarkets()
  ]);

  const bookCounts=new Map<string,number>();
  for(const row of odds.panelMarkets||[]){
   const key=norm(row.sourceBook);
   if(!key)continue;
   bookCounts.set(key,(bookCounts.get(key)||0)+1);
  }
  for(const row of odds.markets||[]){
   for(const book of row.consensus?.books||[]){
    const key=norm(book);
    if(!key)continue;
    bookCounts.set(key,(bookCounts.get(key)||0)+1);
   }
  }

  const sourceCounts=new Map<string,number>();
  for(const contract of predictions.contracts||[]){
   const key=norm(contract.source);
   if(!key)continue;
   sourceCounts.set(key,(sourceCounts.get(key)||0)+1);
  }

  const draftKings=bookCounts.get('draftkings')||0;
  const fanDuel=bookCounts.get('fanduel')||0;
  const kalshiOdds=bookCounts.get('kalshi')||0;
  const polymarketOdds=bookCounts.get('polymarket')||0;
  const kalshiDirect=sourceCounts.get('kalshi')||0;
  const polymarketDirect=sourceCounts.get('polymarket')||0;

  return Response.json({
   ok:true,
   build:RELEASE.build,
   version:RELEASE.appVersion,
   readOnlyMarketData:true,
   executionEnabled:false,
   venues:{
    draftkings:{
     connected:draftKings>0,
     sportsbookQuotes:draftKings,
     path:'authorized-odds-feed'
    },
    fanduel:{
     connected:fanDuel>0,
     sportsbookQuotes:fanDuel,
     path:'authorized-odds-feed'
    },
    kalshi:{
     connected:kalshiDirect>0||kalshiOdds>0,
     directContracts:kalshiDirect,
     sharedFeedQuotes:kalshiOdds,
     path:kalshiDirect>0?'direct-public-api + authorized-odds-feed':'authorized-odds-feed'
    },
    polymarket:{
     connected:polymarketDirect>0||polymarketOdds>0,
     directContracts:polymarketDirect,
     sharedFeedQuotes:polymarketOdds,
     path:polymarketDirect>0?'direct-public-api + authorized-odds-feed':'authorized-odds-feed'
    }
   },
   predictionSources:predictions.sources||[],
   forceLive,
   sportsbookSource:odds.source,
   sportsbookProvider:odds.providerName||odds.providerId||null,
   warnings:[...(odds.warnings||[]),...(predictions.warnings||[])],
   generatedAt:new Date().toISOString()
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({
   ok:false,
   readOnlyMarketData:true,
   executionEnabled:false,
   errorType:error instanceof Error?error.name:'UnknownError',
   generatedAt:new Date().toISOString()
  },{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
