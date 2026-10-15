import {NextRequest} from 'next/server';
import {soccerCandidates} from '@/lib/intelligence-core/soccer-fixture-registry.mjs';
import {extractSoccerScoreObservations} from '@/lib/intelligence-core/soccer-score-observation.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const league=request.nextUrl.searchParams.get('league')||'soccer-epl';
 const candidate=soccerCandidates.find(x=>x.id===league);
 if(!candidate)return Response.json({error:'UNSUPPORTED_SOCCER_LEAGUE',allowed:soccerCandidates.map(x=>x.id)},{status:400});
 const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+encodeURIComponent(candidate.code)+'/scoreboard';
 try{
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4500),next:{revalidate:60}});
  if(!response.ok)throw Error('UPSTREAM_HTTP_'+response.status);
  const length=Number(response.headers.get('content-length')||0);
  if(length>300000)throw Error('UPSTREAM_PAYLOAD_TOO_LARGE');
  const raw=await response.text();
  if(raw.length>300000)throw Error('UPSTREAM_PAYLOAD_TOO_LARGE');
  const observedAt=new Date().toISOString();
  const observations=extractSoccerScoreObservations(JSON.parse(raw),{leagueId:candidate.code,observedAt});
  return Response.json({league:candidate.league,leagueId:candidate.code,observedAt,fixtures:observations,
   fixtureCount:observations.length,classification:'PUBLIC_SCOREBOARD_ONLY',
   sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false,
   draftKingsInventoryCertified:false},{headers:{'Cache-Control':'public, max-age=30, stale-while-revalidate=30'}});
 }catch{
  return Response.json({error:'PUBLIC_SOCCER_SCOREBOARD_UNAVAILABLE',league: candidate.league,
   sourceApprovedForMarketRanking:false,sportsbookOddsAvailable:false},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
