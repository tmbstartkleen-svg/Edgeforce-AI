// Read-only availability probe. Not a licensed sportsbook feed, odds warehouse, or trading bot.
const providers=Object.freeze([
 {id:'kalshi',kind:'PREDICTION_EXCHANGE',url:'https://api.elections.kalshi.com/trade-api/v2/markets?limit=10&status=open',arrayKey:'markets'},
 {id:'polymarket',kind:'PREDICTION_EXCHANGE',url:'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=10',arrayKey:null}
]);
export async function probeProvider(provider,{fetcher=fetch,now=Date.now}={}){
 const started=now();
 try{
  const response=await fetcher(provider.url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6000)});
  if(!response.ok)return {provider:provider.id,kind:provider.kind,healthy:false,httpStatus:response.status,latencyMs:now()-started};
  const raw=await response.text();
  if(Buffer.byteLength(raw)>250000)return {provider:provider.id,kind:provider.kind,healthy:false,reason:'PAYLOAD_LIMIT',latencyMs:now()-started};
  const payload=JSON.parse(raw);
  const records=provider.arrayKey?payload?.[provider.arrayKey]:payload;
  if(!Array.isArray(records))return {provider:provider.id,kind:provider.kind,healthy:false,reason:'SCHEMA_MISMATCH',latencyMs:now()-started};
  return {provider:provider.id,kind:provider.kind,healthy:true,httpStatus:response.status,latencyMs:now()-started,returnedRecords:records.length};
 }catch(error){return {provider:provider.id,kind:provider.kind,healthy:false,reason:error?.name==='TimeoutError'?'TIMEOUT':'FETCH_FAILED',latencyMs:now()-started};}
}
export async function probePublicProviders(options={}){
 const checks=[];
 for(const provider of providers)checks.push(await probeProvider(provider,options));
 return {checkedAt:new Date().toISOString(),mode:'READ_ONLY_PUBLIC_MARKET_DISCOVERY',licensedSportsbookOdds:false,liveSportsCollectionEnabled:false,checks};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const report=await probePublicProviders();
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(report.checks.every(x=>!x.healthy))process.exitCode=1;
}
