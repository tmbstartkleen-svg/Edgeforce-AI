import {extractSoccerScoreObservations} from '../src/lib/intelligence-core/soccer-score-observation.mjs';
import {soccerCandidates} from '../src/lib/intelligence-core/soccer-fixture-registry.mjs';
export async function probeSoccerLeague(candidate,{fetcher=fetch,clock=Date.now}={}){
 const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+encodeURIComponent(candidate.code)+'/scoreboard';
 const started=clock();
 try{
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6500)});
  if(!response.ok)return {league:candidate.league,id:candidate.id,reachable:false,httpStatus:response.status,latencyMs:clock()-started,fixtures:0};
  const body=await response.text();
  if(Buffer.byteLength(body)>300000)return {league:candidate.league,id:candidate.id,reachable:false,reason:'PAYLOAD_TOO_LARGE',latencyMs:clock()-started,fixtures:0};
  const data=JSON.parse(body);
  if(!Array.isArray(data.events))return {league:candidate.league,id:candidate.id,reachable:false,reason:'INVALID_EVENTS_SCHEMA',latencyMs:clock()-started,fixtures:0};
  const events=data.events.slice(0,100).filter(x=>typeof x.id==='string'&&!!x.id&&typeof x.date==='string');
  return {league:candidate.league,id:candidate.id,reachable:true,latencyMs:clock()-started,fixtures:events.length,fixtureIds:events.map(x=>x.id),scoreObservations:extractSoccerScoreObservations(data,{leagueId:candidate.code,observedAt:new Date().toISOString()}),oddsLicensed:false,approvedSource:false};
 }catch{return {league:candidate.league,id:candidate.id,reachable:false,reason:'FETCH_OR_PARSE_ERROR',latencyMs:clock()-started,fixtures:0};}
}
export async function probeSoccerLeagues({fetcher=fetch,clock=Date.now,candidates=soccerCandidates}={}){
 const results=[];
 // Sequentially throttle across bounded candidate list; stay off Worker cron subrequest budget.
 for(const candidate of candidates.slice(0,24))results.push(await probeSoccerLeague(candidate,{fetcher,clock}));
 return {checkedAt:new Date().toISOString(),mode:'PUBLIC_SCOREBOARD_AVAILABILITY_ONLY',draftKingsFixturesCertified:false,licensedSportsbookOdds:false,
  attempted:results.length,reachable:results.filter(x=>x.reachable).length,
  observedFixtures:results.reduce((sum,x)=>sum+x.fixtures,0),
  scoreObservations:results.flatMap(x=>x.scoreObservations||[]),
  scoreObservationsApprovedForMarketRanking:false,
  reachableEmptyLeagues:results.filter(x=>x.reachable&&x.fixtures===0).map(x=>x.league),
  unavailableLeagues:results.filter(x=>!x.reachable).map(x=>x.league),results};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const fs=await import('node:fs');
 const report=await probeSoccerLeagues();
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 else process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(report.reachable===0)process.exitCode=1;
}
