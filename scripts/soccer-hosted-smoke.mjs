/** Hosted route smoke: verify a real deployed endpoint and its safety contract.
 * Do not confuse a deployed 200 response with licensed sportsbook coverage.
 */
export async function smokeHostedSoccerFixtures(baseUrl,{fetcher=fetch,timeoutMs=6000}={}){
 const url=new URL('/api/soccer-fixtures?league=soccer-epl',baseUrl);
 const started=Date.now();
 try{
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)return {reachable:false,httpStatus:response.status,latencyMs:Date.now()-started,reason:'HOSTED_HTTP_'+response.status,licensedOddsVerified:false};
  const data=await response.json();
  const valid=Array.isArray(data.fixtures)&&data.leagueId==='eng.1'&&
   data.classification==='PUBLIC_SCOREBOARD_ONLY'&&data.sourceApprovedForMarketRanking===false&&
   data.sportsbookOddsAvailable===false&&data.draftKingsInventoryCertified===false&&
   data.fixtures.every(x=>x.sourceApproved===false&&x.licensedOdds===false);
  return {reachable:valid,httpStatus:response.status,latencyMs:Date.now()-started,
   fixtureCount:valid?data.fixtures.length:0,reason:valid?'PUBLIC_FIXTURES_CONTRACT_OK':'INVALID_OR_UNSAFE_CONTRACT',licensedOddsVerified:false};
 }catch{return {reachable:false,latencyMs:Date.now()-started,reason:'HOSTED_FETCH_OR_JSON_ERROR',licensedOddsVerified:false};}
}
if(import.meta.url===`file://${process.argv[1]}`){
 const url=process.env.EDGEFORCE_SOCCER_SMOKE_URL||'https://edgeforce-ai.tmbstartkleen.workers.dev';
 const result=await smokeHostedSoccerFixtures(url);
 console.log(JSON.stringify({target:url,...result},null,2));
 if(!result.reachable)process.exitCode=1;
}
