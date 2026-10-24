/** Canonical market identity and movement calculations from provider-observed prices. */
const required=(x)=>typeof x==='string'&&x.trim().length>0;
const decimal=(a)=>Number.isInteger(a)&&(a<=-100||a>=100)?(a>0?1+a/100:1+100/-a):NaN;
const implied=(a)=>1/decimal(a);
const periodKind=(market)=>/player|prop|alternate|alt[_ -]|spread|handicap|total|over.?under|team.?total|period|quarter|half|first.?five/i.test(market);

/** Do not silently merge different prop thresholds, stat units, periods or over/under lines. */
export function canonicalMarketIdentity(q){
 if(!q||![q.eventId,q.marketKey,q.settlementKey,q.selection].every(required))return {ok:false,reason:'MISSING_EVENT_MARKET_OR_SETTLEMENT'};
 const derivative=periodKind(q.marketKey);
 if(derivative && !required(q.lineKey))return {ok:false,reason:'DERIVATIVE_LINE_IDENTITY_REQUIRED'};
 if(derivative && !required(q.periodKey))return {ok:false,reason:'PERIOD_IDENTITY_REQUIRED'};
 if(/player|prop/i.test(q.marketKey) && !required(q.playerId))return {ok:false,reason:'PLAYER_IDENTITY_REQUIRED'};
 if(/player|prop/i.test(q.marketKey) && !required(q.statKey))return {ok:false,reason:'PLAYER_STAT_REQUIRED'};
 const axis=[q.eventId,q.marketKey,q.settlementKey,q.lineKey||'STRAIGHT',q.periodKey||'FULL',q.playerId||'',q.statKey||''];
 return {ok:true,identity:JSON.stringify(axis),marketClass:derivative?'DERIVATIVE':'STRAIGHT',axis};
}

/** Historical observations keep a separate trace per owner/book/line/selection. */
export function lineMovementSeries(quotes,{now=Date.now(),maxAgeMs=86400000,maxRows=10000}={}){
 if(!Array.isArray(quotes)||!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<0||!Number.isInteger(maxRows)||maxRows<0||maxRows>10000)
  throw new TypeError('INVALID_MOVEMENT_INPUT');
 const groups=new Map(),rejected=[];
 for(const q of quotes.slice(0,maxRows)){
  const identity=canonicalMarketIdentity(q);
  if(!identity.ok){rejected.push(identity.reason);continue;}
  if(![q.bookmaker,q.providerId,q.upstreamId].every(required)||!Number.isFinite(q.observedAt)||
   q.observedAt>now+60000||now-q.observedAt>maxAgeMs||!Number.isFinite(decimal(q.odds))){
   rejected.push('INVALID_PRICE_PROVIDER_OR_TIMESTAMP');continue;
  }
  const key=JSON.stringify([identity.identity,q.selection,q.bookmaker,q.providerId,q.upstreamId]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);
 }
 const series=[];
 for(const [key,items] of groups){
  items.sort((a,b)=>a.observedAt-b.observedAt);
  const ordered=[];for(const q of items){
   if(ordered.length&&ordered[ordered.length-1].observedAt===q.observedAt){
    if(ordered[ordered.length-1].odds!==q.odds){rejected.push('CONFLICTING_SAME_TIMESTAMP_QUOTES');ordered.length=0;break;}
    continue;
   }
   ordered.push(q);
  }
  if(!ordered.length)continue;
  const first=ordered[0],last=ordered[ordered.length-1];
  series.push({key,eventId:last.eventId,marketKey:last.marketKey,selection:last.selection,bookmaker:last.bookmaker,
   providerId:last.providerId,upstreamId:last.upstreamId,lineKey:last.lineKey||null,periodKey:last.periodKey||'FULL',
   playerId:last.playerId||null,statKey:last.statKey||null,
   observations:ordered.length,firstObservedAt:first.observedAt,lastObservedAt:last.observedAt,
   openingOdds:first.odds,latestOdds:last.odds,openingImpliedProbability:implied(first.odds),
   latestImpliedProbability:implied(last.odds),movementPercentagePoints:100*(implied(last.odds)-implied(first.odds)),
   lineMoved:ordered.length>1&&first.odds!==last.odds,priceSource:'PROVIDER_OBSERVATIONS_ONLY',
   closingLineCertified:false});
 }
 return {series:series.sort((a,b)=>b.lastObservedAt-a.lastObservedAt),rejectionCount:rejected.length,
  rejectionReasons:rejected.reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{}),
  simulatedQuotes:0,networkRequests:0};
}

/** No-vig probabilities computed only from matched exhaustive outcome sets at one book and timestamp. */
export function matchedNoVig(quotes,{now=Date.now(),maxAgeMs=1200000}={}){
 if(!Array.isArray(quotes))throw new TypeError('INVALID_DEVIG_INPUT');
 const groups=new Map(),rejected=[];
 for(const q of quotes.slice(0,10000)){
  const id=canonicalMarketIdentity(q);
  if(!id.ok){rejected.push(id.reason);continue;}
  if(![q.bookmaker,q.upstreamId,q.providerId].every(required)||!Number.isFinite(q.observedAt)||
    q.observedAt>now+60000||now-q.observedAt>maxAgeMs||!Number.isFinite(decimal(q.odds))||
    !Array.isArray(q.outcomes)||![2,3].includes(q.outcomes.length)||!q.outcomes.includes(q.selection)){
   rejected.push('INVALID_OUTCOME_OR_PRICE');continue;}
  const key=JSON.stringify([id.identity,q.bookmaker,q.providerId,q.upstreamId,q.observedAt,[...q.outcomes].sort()]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);
 }
 const results=[];
 for(const [key,items] of groups){
  const options=items[0].outcomes;
  if(items.length!==options.length||new Set(items.map(x=>x.selection)).size!==options.length){rejected.push('INCOMPLETE_OR_DUPLICATED_OUTCOMES');continue;}
  const overround=items.reduce((s,q)=>s+implied(q.odds),0);
  if(!(overround>=.95&&overround<=1.40)){rejected.push('IMPLAUSIBLE_OVERROUND');continue;}
  results.push({identity:key,bookmaker:items[0].bookmaker,observedAt:items[0].observedAt,
   overround,marginPercentagePoints:(overround-1)*100,
   probabilities:items.map(q=>({selection:q.selection,odds:q.odds,rawImpliedProbability:implied(q.odds),
    noVigProbability:implied(q.odds)/overround})),source:'ONE_VERIFIED_OUTCOME_SET'});
 }
 return {results,rejectedCount:rejected.length,rejectionReasons:rejected.reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{}),externalRequests:0};
}
