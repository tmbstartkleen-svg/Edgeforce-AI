import {ingestOdds} from '@/lib/providers/ingest';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {buildUniversalSnapshot,equivalentContractPair} from '@/lib/universalMarkets';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const requested=(url.searchParams.get('domain')||'ALL').toUpperCase();
 const [odds,predictions]=await Promise.all([
  ingestOdds().catch(()=>({markets:[],source:null,providerId:null,providerName:null,mode:'failed',degraded:true,attempts:[],warnings:['sportsbook ingestion unavailable']} as any)),
  fetchPredictionMarkets().catch(()=>({contracts:[],sources:[],warnings:['prediction-market ingestion unavailable'],mode:'failed',source:null,attempts:[]} as any))
 ]);
 const snapshot=buildUniversalSnapshot(odds.markets||[],predictions.contracts||[]);
 const quotes=requested==='SPORTS'?snapshot.sports:requested==='MARKETS'?snapshot.markets:snapshot.quotes;

 const predictionOnly=snapshot.quotes.filter(x=>x.venueType!=='SPORTSBOOK');
 const pairs:Array<Record<string,unknown>>=[];
 for(let i=0;i<predictionOnly.length;i++){
  for(let j=i+1;j<predictionOnly.length;j++){
   const a=predictionOnly[i],b=predictionOnly[j];
   const match=equivalentContractPair(a,b);
   if(match.similarity<.60)continue;
   pairs.push({
    a:{id:a.id,venue:a.venue,title:a.title,probability:a.impliedProbability},
    b:{id:b.id,venue:b.venue,title:b.title,probability:b.impliedProbability},
    ...match,
    probabilityGap:Math.abs(a.impliedProbability-b.impliedProbability)
   });
  }
 }
 pairs.sort((a,b)=>Number(b.probabilityGap||0)-Number(a.probabilityGap||0));

 return Response.json({
  ok:quotes.length>0,
  generatedAt:new Date().toISOString(),
  domain:requested,
  analyticsOnly:true,
  executionEnabled:false,
  summary:{
   total:snapshot.quotes.length,
   sports:snapshot.sports.length,
   markets:snapshot.markets.length,
   draftKings:snapshot.sports.filter(x=>x.venue.toLowerCase().includes('draftkings')).length,
   fanDuel:snapshot.sports.filter(x=>x.venue.toLowerCase().includes('fanduel')).length,
   kalshi:snapshot.quotes.filter(x=>x.venue.toLowerCase().includes('kalshi')).length,
   polymarket:snapshot.quotes.filter(x=>x.venue.toLowerCase().includes('polymarket')).length
  },
  capabilities:snapshot.capabilities,
  quotes,
  crossVenueCandidates:pairs.slice(0,100),
  sources:{
   sportsbook:{providerId:odds.providerId||null,providerName:odds.providerName||null,mode:odds.mode||null,warnings:odds.warnings||[]},
   predictionMarkets:{source:predictions.source||null,mode:predictions.mode||null,sources:predictions.sources||[],warnings:predictions.warnings||[]}
  },
  warnings:[
   'DraftKings and FanDuel are analytics data venues only when available through configured/authorized odds providers; this endpoint does not automate wagering.',
   'Cross-venue candidates are not treated as equivalent until wording, expiry, resolution source, fees and settlement rules are verified.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
