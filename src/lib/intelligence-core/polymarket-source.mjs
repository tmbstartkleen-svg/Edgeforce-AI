/**
 * Bounded real HTTP source adapter for Polymarket Gamma public event catalog.
 * No write side effects. Events remain UNCLASSIFIED until independently tagged
 * as sports or non-sports and provider terms are reviewed for intended use.
 */
const ENDPOINT='https://gamma-api.polymarket.com/events?active=true&closed=false&limit=5';
export async function probePolymarketEvents({fetchImpl=fetch,signal}={}){
 const response=await fetchImpl(ENDPOINT,{method:'GET',headers:{Accept:'application/json'},signal});
 if(!response?.ok)throw Error('POLYMARKET_UPSTREAM_UNAVAILABLE');
 const length=Number(response.headers?.get?.('content-length')||0);
 if(length>262144)throw Error('POLYMARKET_RESPONSE_TOO_LARGE');
 const text=await response.text();
 if(new TextEncoder().encode(text).byteLength>262144)throw Error('POLYMARKET_RESPONSE_TOO_LARGE');
 let events;try{events=JSON.parse(text)}catch{throw Error('POLYMARKET_INVALID_JSON')}
 if(!Array.isArray(events)||events.length>5)throw Error('POLYMARKET_UNEXPECTED_SHAPE');
 const items=events.map(event=>{
  if(!event||typeof event!=='object'||typeof event.id!=='string'&&typeof event.id!=='number')
   throw Error('POLYMARKET_INVALID_EVENT');
  return {source:'polymarket-gamma',upstreamId:'polymarket',eventId:String(event.id),
   title:String(event.title??'').slice(0,240),
   active:event.active===true,closed:event.closed===true,
   marketCount:Array.isArray(event.markets)?event.markets.length:null,
   division:'UNCLASSIFIED',livePriceVerified:false,archived:false};
 });
 return {source:'polymarket-gamma',sourceKind:'PUBLIC_EVENT_CATALOG',
  division:'UNCLASSIFIED',observedVia:'LIVE_HTTP_FETCH',count:items.length,
  items,storedInD1:false,validatedLicenseForReuse:false};
}
