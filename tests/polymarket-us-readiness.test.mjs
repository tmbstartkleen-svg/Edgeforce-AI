import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {
 connectionConfiguration,prepareUSCombo,retailReadAuthHeaders,checkUSConnection,polymarketUSReadinessGateway
} from '../src/lib/intelligence-core/polymarket-us-readiness.mjs';

const now=Date.parse('2026-11-09T17:00:00Z');
const choices=[
 {eventSlug:'game-a',marketSlug:'winner-a',outcomeId:'101'},
 {eventSlug:'game-b',marketSlug:'over-44pt5',outcomeId:'202'},
];
const event=(i=0)=>({
 slug:choices[i].eventSlug,title:`Game ${i}`,active:true,closed:false,
 markets:[{slug:choices[i].marketSlug,question:i?'Over 44.5':'Team A wins',
  active:true,closed:false,status:'MARKET_STATUS_OPEN',comboEnabled:true,
  gameStartTime:'2026-11-10T01:15:00Z',line:i?44.5:null,
  marketSides:[{id:choices[i].outcomeId,identifier:choices[i].marketSlug,
   description:i?'Under':'Team A',long:!i,tradable:true,price:'0.55'}]}],
});
const response=data=>Response.json(data);
const mockEvents=(change=()=>{})=>async url=>{
 const i=String(url).endsWith('/game-b')?1:0;
 const e=event(i);change(e,i);return response({event:e});
};
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const seed=privateKey.export({format:'der',type:'pkcs8'}).subarray(-32);
const env={POLYMARKET_US_KEY_ID:'test-only-id',POLYMARKET_US_SECRET_KEY:seed.toString('base64'),
 CRON_SECRET:'test-operator-secret-with-more-than-32-characters'};

test('configuration is strictly read-only',()=>{
 const c=connectionConfiguration(env);
 assert.equal(c.credentialsConfigured,true);
 assert.equal(c.authenticated,false);
 assert.equal(c.instrumentCreationSupported,false);
 assert.equal(c.orderSubmissionSupported,false);
 assert.equal(c.accountMutationSupported,false);
});

test('prepares exact Combo legs without creating an instrument or order',async()=>{
 const p=await prepareUSCombo(choices,{now,fetchImpl:mockEvents()});
 assert.deepEqual(p.requestBody.legs,[{symbol:'winner-a',side:'SIDE_BUY'},{symbol:'over-44pt5',side:'SIDE_SELL'}]);
 assert.equal(p.legs[1].selection,'Under');
 assert.equal(p.mode,'READ_ONLY_COMBO_PREPARATION');
 assert.equal(p.instrumentCreated,false);
 assert.equal(p.orderSubmitted,false);
 assert.equal(p.externalWrites,0);
 assert.equal(p.appUrl,null);
});

test('rejects identity, state, start-time, tradeability and Combo-support failures',async()=>{
 const cases=[
  [e=>{e.slug='wrong-game';},'EVENT_IDENTITY_MISMATCH'],
  [e=>{e.markets[0].slug='other-market';},'MARKET_NOT_IN_EVENT'],
  [e=>{e.markets[0].marketSides[0].id='999';},'OUTCOME_IDENTITY_MISMATCH'],
  [e=>{e.closed=true;},'EVENT_NOT_OPEN'],
  [e=>{e.markets[0].status='MARKET_STATUS_HALTED';},'MARKET_NOT_OPEN'],
  [e=>{e.markets[0].marketSides[0].tradable=false;},'OUTCOME_NOT_TRADABLE'],
  [e=>{e.markets[0].comboEnabled=false;},'MARKET_NOT_COMBO_ENABLED'],
  [e=>{e.markets[0].gameStartTime='2026-11-08T01:00:00Z';},'EVENT_ALREADY_STARTED'],
  [e=>{delete e.markets[0].gameStartTime;},'START_TIME_UNVERIFIED'],
 ];
 for(const [change,code] of cases)await assert.rejects(prepareUSCombo(choices,{now,fetchImpl:mockEvents(change)}),{message:code});
});

test('read-only auth signature verifies only GET balances',async()=>{
 const h=await retailReadAuthHeaders(env,'/v1/account/balances',now);
 assert.equal(verify(null,Buffer.from(`${now}GET/v1/account/balances`),publicKey,Buffer.from(h['X-PM-Signature'],'base64')),true);
 await assert.rejects(retailReadAuthHeaders(env,'/v1/combos',now),/INVALID_READ_AUTH_REQUEST/);
});

test('connection check discards balances and secrets',async()=>{
 const r=await checkUSConnection(env,{now,fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.polymarket.us/v1/account/balances');
  assert.equal(options.redirect,'manual');
  return response({privateBalance:'secret-account-data'});
 }});
 assert.equal(r.authenticated,true);
 assert.equal(r.externalWrites,0);
 assert.doesNotMatch(JSON.stringify(r),/secret-account-data|test-only-id/);
});

test('manual redirects are not followed with credentials',async()=>{
 let calls=0;
 await assert.rejects(checkUSConnection(env,{now,fetchImpl:async(url,options)=>{
  calls++;assert.equal(options.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/'}});
 }}),/POLYMARKET_US_REQUEST_REJECTED/);
 assert.equal(calls,1);
});

test('gateway rejects create and order routes while allowing preparation',async()=>{
 const auth={authorization:`Bearer ${env.CRON_SECRET}`,'content-type':'application/json'};
 const make=(path,body)=>new Request(`https://edgeforce.test/api/polymarket-us/${path}`,{
  method:'POST',headers:auth,body:JSON.stringify(body)
 });
 assert.equal((await polymarketUSReadinessGateway(make('combos/create',{selections:choices}),env)).status,405);
 assert.equal((await polymarketUSReadinessGateway(make('orders',{quantity:1}),env)).status,405);
 const prepared=await polymarketUSReadinessGateway(make('combos/prepare',{selections:choices}),env,{now,fetchImpl:mockEvents()});
 assert.equal(prepared.status,200);
 const body=await prepared.json();
 assert.equal(body.instrumentCreated,false);
 assert.equal(body.orderSubmitted,false);
 assert.equal(body.externalWrites,0);
});

test('status never exposes credentials and operator routes fail closed',async()=>{
 const status=await polymarketUSReadinessGateway(new Request('https://edgeforce.test/api/polymarket-us/status'),env);
 assert.equal(status.status,200);
 assert.doesNotMatch(await status.text(),/test-only-id|test-operator-secret|secret_key/);
 const noAuth=await polymarketUSReadinessGateway(new Request('https://edgeforce.test/api/polymarket-us/connection'),env);
 assert.equal(noAuth.status,401);
});

test('request and upstream byte limits remain fail closed',async()=>{
 const request=new Request('https://edgeforce.test/api/polymarket-us/combos/prepare',{
  method:'POST',headers:{authorization:`Bearer ${env.CRON_SECRET}`,'content-type':'application/json'},
  body:JSON.stringify({selections:choices,excess:'x'.repeat(32769)})
 });
 const r=await polymarketUSReadinessGateway(request,env);
 assert.equal(r.status,413);
 await assert.rejects(prepareUSCombo(choices,{now,fetchImpl:async()=>new Response('x',{headers:{'content-length':'9000000'}})}),/RESPONSE_TOO_LARGE/);
});
