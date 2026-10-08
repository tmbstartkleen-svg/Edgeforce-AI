import {randomUUID} from 'node:crypto';
import {db} from './db';
import {uploadedBetHistory,type HistoricalBet,type HistoricalLeg,type LegResult} from './betHistory';
import {backfillClosingOddsForSlip} from './lineMovement';

export type WagerLegInput={
 ordinal?:number;
 label:string;
 sport:string;
 marketType:string;
 eventId?:string;
 sourceEventId?:string;
 event?:string;
 offeredOdds?:number;
 modelProbability?:number;
 rawImpliedProbability?:number;
 noVigProbability?:number;
 predictionMarketProbability?:number;
};

export type WagerInput={
 id?:string;
 placedAt?:string;
 source?:'manual'|'api'|'uploaded-screenshot';
 confidence?:'confirmed'|'partial';
 sportsbook?:string;
 sport?:string;
 stake:number;
 combinedOdds?:number;
 potentialReturn?:number;
 modelProbability?:number;
 notes?:string;
 bankrollAccountId?:number;
 legs:WagerLegInput[];
};

export type SettlementLegInput={
 ordinal?:number;
 eventId?:string;
 marketType?:string;
 selection?:string;
 result:LegResult;
 closingOdds?:number;
};

export type SettlementInput={
 betSlipId:string;
 legs?:SettlementLegInput[];
 result?:'win'|'loss'|'push'|'open';
 returned?:number;
 settledAt?:string;
 source?:string;
 bankrollAccountId?:number;
};

const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.abs(odds);
const asNumber=(v:unknown,fallback=0)=>typeof v==='number'?v:Number(v??fallback);
const clampProbability=(v:unknown)=>{
 const n=asNumber(v,NaN);
 return Number.isFinite(n)?Math.max(0,Math.min(1,n)):undefined;
};

let historyCache:{at:number;rows:HistoricalBet[]}|null=null;
const CACHE_MS=3000;

export function invalidateLedgerCache(){historyCache=null}

export async function loadLedgerHistory():Promise<HistoricalBet[]>{
 if(historyCache&&Date.now()-historyCache.at<CACHE_MS)return historyCache.rows;
 const sql=db();
 if(!sql){
  historyCache={at:Date.now(),rows:uploadedBetHistory};
  return uploadedBetHistory;
 }
 try{
  const slips=await sql`
   select id,placed_at as "placedAt",source,confidence,sport,leg_count as "legCount",
    stake::float,returned::float,result,notes,combined_odds as "combinedOdds",
    model_probability::float as "modelProbability",settled_at as "settledAt"
   from bet_slips
   order by placed_at asc
  `;
  const legs=await sql`
   select bet_slip_id as "betSlipId",ordinal,sport,market_type as "marketType",
    selection as label,result,offered_odds as "offeredOdds",event_id as "eventId",
    metadata->>'sourceEventId' as "sourceEventId",
    event_label as event,model_probability::float as "modelProbability",
    closing_odds as "closingOdds",clv_probability::float as clv
   from bet_legs
   order by bet_slip_id,ordinal
  `;
  const legMap=new Map<string,HistoricalLeg[]>();
  for(const row of legs as any[]){
   const list=legMap.get(row.betSlipId)||[];
   list.push({
    label:String(row.label),
    sport:String(row.sport||'Unknown'),
    marketType:String(row.marketType||'Unknown'),
    result:(row.result||'unknown') as LegResult,
    offeredOdds:row.offeredOdds??undefined,
    closingOdds:row.closingOdds??undefined,
    clv:Number.isFinite(Number(row.clv))?Number(row.clv):undefined,
    eventId:row.eventId??undefined,
    sourceEventId:row.sourceEventId??undefined,
    event:row.event??undefined,
    modelProbability:clampProbability(row.modelProbability)
   });
   legMap.set(row.betSlipId,list);
  }
  const persisted=(slips as any[]).map((row):HistoricalBet=>({
   id:String(row.id),
   placedAt:new Date(row.placedAt).toISOString(),
   source:(row.source||'api') as HistoricalBet['source'],
   confidence:(row.confidence||'confirmed') as HistoricalBet['confidence'],
   sport:String(row.sport||'Mixed'),
   legCount:Number(row.legCount||0),
   stake:asNumber(row.stake),
   paid:asNumber(row.returned),
   result:(row.result||'open') as HistoricalBet['result'],
   combinedOdds:row.combinedOdds??undefined,
   modelProbability:clampProbability(row.modelProbability),
   settledAt:row.settledAt?new Date(row.settledAt).toISOString():undefined,
   legs:legMap.get(String(row.id))||[],
   notes:row.notes??undefined
  }));
  const merged=new Map(uploadedBetHistory.map(x=>[x.id,x]));
  for(const row of persisted)merged.set(row.id,row);
  const rows=[...merged.values()].sort((a,b)=>new Date(a.placedAt).getTime()-new Date(b.placedAt).getTime());
  historyCache={at:Date.now(),rows};
  return rows;
 }catch{
  historyCache={at:Date.now(),rows:uploadedBetHistory};
  return uploadedBetHistory;
 }
}

export async function loadSettlementEvidenceHistory(limit=100){
 const sql=db();
 const bounded=Math.max(1,Math.min(500,Math.floor(Number(limit)||100)));
 if(!sql)return {mode:'dry-run' as const,rows:[],count:0,evidenceClasses:{}};
 const rows=await sql`
  select
   le.id,
   le.bet_slip_id as "betSlipId",
   le.source,
   le.payload,
   le.created_at as "createdAt",
   bl.ordinal,
   bl.sport,
   bl.market_type as "marketType",
   bl.selection,
   bl.event_id as "eventId",
   bl.result,
   bl.settled_at as "settledAt",
   bl.metadata->'settlementProvenance' as "legProvenance"
  from ledger_events le
  left join bet_legs bl
   on bl.bet_slip_id=le.bet_slip_id
   and bl.ordinal=case
    when jsonb_typeof(le.payload->'ordinal')='number' then (le.payload->>'ordinal')::int
    else null
   end
  where le.event_type='RESULT_EVIDENCE_APPLIED'
  order by le.created_at desc,le.id desc
  limit ${bounded}
 `;
 const normalized=(rows as any[]).map(row=>({
  id:Number(row.id),
  betSlipId:row.betSlipId?String(row.betSlipId):null,
  source:row.source?String(row.source):null,
  createdAt:row.createdAt?new Date(row.createdAt).toISOString():null,
  ordinal:row.ordinal==null?null:Number(row.ordinal),
  sport:row.sport?String(row.sport):null,
  marketType:row.marketType?String(row.marketType):null,
  selection:row.selection?String(row.selection):null,
  eventId:row.eventId?String(row.eventId):null,
  result:row.result?String(row.result):null,
  settledAt:row.settledAt?new Date(row.settledAt).toISOString():null,
  settlementProvenance:row.legProvenance||row.payload?.settlementProvenance||null,
  payload:row.payload||{}
 }));
 const evidenceClasses:Record<string,number>={};
 const identityMatches:Record<string,number>={};
 let identityTagged=0;
 for(const row of normalized){
  const key=String(row.settlementProvenance?.evidenceClass||'UNSPECIFIED');
  evidenceClasses[key]=(evidenceClasses[key]||0)+1;
  const identity=String(row.payload?.identityMatch||'').trim();
  if(identity){
   identityMatches[identity]=(identityMatches[identity]||0)+1;
   identityTagged++;
  }
 }
 return {
  mode:'database' as const,
  rows:normalized,
  count:normalized.length,
  evidenceClasses,
  identityMatches,
  identityCoverage:normalized.length?Number((identityTagged/normalized.length).toFixed(3)):1
 };
}

export async function recordWager(input:WagerInput){
 if(!Number.isFinite(input.stake)||input.stake<=0)throw new Error('stake must be greater than zero');
 if(!Array.isArray(input.legs)||!input.legs.length)throw new Error('at least one leg is required');
 const sql=db();
 const id=input.id||randomUUID();
 const placedAt=input.placedAt||new Date().toISOString();
 const potentialReturn=input.potentialReturn??(input.combinedOdds?input.stake*decimal(input.combinedOdds):undefined);
 if(!sql)return {ok:true,mode:'dry-run' as const,id,potentialReturn};

 const existing=await sql`select id,result from bet_slips where id=${id} limit 1`;
 await sql`
  insert into bet_slips(
   id,placed_at,source,confidence,sport,leg_count,stake,returned,result,notes,raw,
   sportsbook,combined_odds,potential_return,model_probability,net_pnl,updated_at
  ) values(
   ${id},${placedAt},${input.source||'manual'},${input.confidence||'confirmed'},
   ${input.sport||[...new Set(input.legs.map(x=>x.sport))].join(' + ')},
   ${input.legs.length},${input.stake},0,'open',${input.notes??null},'{}'::jsonb,
   ${input.sportsbook||'DraftKings'},${input.combinedOdds??null},${potentialReturn??null},
   ${input.modelProbability??null},0,now()
  )
  on conflict (id) do update set
   placed_at=excluded.placed_at,source=excluded.source,confidence=excluded.confidence,
   sport=excluded.sport,leg_count=excluded.leg_count,stake=excluded.stake,notes=excluded.notes,
   sportsbook=excluded.sportsbook,combined_odds=excluded.combined_odds,
   potential_return=excluded.potential_return,model_probability=excluded.model_probability,updated_at=now()
 `;
 await sql`delete from bet_legs where bet_slip_id=${id}`;
 const internalEventIds=[...new Set(input.legs.map(x=>x.eventId).filter((x):x is string=>Boolean(x)))];
 const providerEventIds=new Map<string,string>();
 if(internalEventIds.length){
  const mapped=await sql`
   select id,provider_event_id as "providerEventId"
   from events
   where id in (select value from jsonb_array_elements_text(${sql.json(internalEventIds)}::jsonb))
  `;
  for(const row of mapped as any[]){
   if(row.id&&row.providerEventId)providerEventIds.set(String(row.id),String(row.providerEventId));
  }
 }
 const recordedSourceEventIds:string[]=[];
 for(let i=0;i<input.legs.length;i++){
  const leg=input.legs[i];
  const sourceEventId=leg.sourceEventId||(leg.eventId?providerEventIds.get(leg.eventId):undefined);
  if(sourceEventId)recordedSourceEventIds.push(sourceEventId);
  await sql`
   insert into bet_legs(
    bet_slip_id,ordinal,sport,market_type,selection,result,offered_odds,event_id,event_label,
    model_probability,raw_implied_probability,no_vig_probability,prediction_market_probability,metadata
   ) values(
    ${id},${leg.ordinal??i+1},${leg.sport},${leg.marketType},${leg.label},'unknown',
    ${leg.offeredOdds??null},${leg.eventId??null},${leg.event??null},${leg.modelProbability??null},
    ${leg.rawImpliedProbability??null},${leg.noVigProbability??null},
    ${leg.predictionMarketProbability??null},${sql.json(sourceEventId?{sourceEventId}:{})}
   )
  `;
 }
 if(!existing.length&&input.bankrollAccountId){
  await sql`update bankroll_accounts set current_bankroll=current_bankroll-${input.stake},updated_at=now() where id=${input.bankrollAccountId}`;
 }
 await sql`insert into ledger_events(bet_slip_id,event_type,source,payload) values(${id},'WAGER_RECORDED',${input.source||'manual'},${sql.json({stake:input.stake,combinedOdds:input.combinedOdds,potentialReturn,legCount:input.legs.length,sourceEventIds:[...new Set(recordedSourceEventIds)]})})`;
 invalidateLedgerCache();
 return {ok:true,mode:'database' as const,id,potentialReturn};
}

async function deriveSlipState(sql:any,betSlipId:string,explicit?:SettlementInput['result']){
 const [slip]=await sql`select id,stake::float,returned::float,result,combined_odds as "combinedOdds",potential_return::float as "potentialReturn" from bet_slips where id=${betSlipId} limit 1`;
 if(!slip)throw new Error('bet slip not found');
 const legs=await sql`select result from bet_legs where bet_slip_id=${betSlipId} order by ordinal`;
 const statuses=(legs as any[]).map(x=>String(x.result));
 let result=explicit;
 if(!result){
  if(statuses.some(x=>x==='loss'))result='loss';
  else if(statuses.length&&statuses.every(x=>x==='push'))result='push';
  else if(statuses.length&&statuses.every(x=>x==='win'||x==='push'))result='win';
  else result='open';
 }
 return {slip,result};
}

export async function settleWager(input:SettlementInput){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,betSlipId:input.betSlipId};
 const before=await sql`select result from bet_slips where id=${input.betSlipId} limit 1`;
 if(!before.length)throw new Error('bet slip not found');
 const settledAt=input.settledAt||new Date().toISOString();

 for(const leg of input.legs||[]){
  if(leg.ordinal!==undefined){
   await sql`
    update bet_legs set result=${leg.result},closing_odds=${leg.closingOdds??null},
     settled_at=case when ${leg.result}='unknown' then null else ${settledAt}::timestamptz end
    where bet_slip_id=${input.betSlipId} and ordinal=${leg.ordinal}
   `;
  }else if(leg.eventId&&leg.selection){
   await sql`
    update bet_legs set result=${leg.result},closing_odds=${leg.closingOdds??null},
     settled_at=case when ${leg.result}='unknown' then null else ${settledAt}::timestamptz end
    where bet_slip_id=${input.betSlipId} and event_id=${leg.eventId}
     and lower(selection)=lower(${leg.selection})
     and (${leg.marketType??null}::text is null or lower(market_type)=lower(${leg.marketType??''}))
   `;
  }
 }
 await backfillClosingOddsForSlip(input.betSlipId).catch(()=>0);
 const {slip,result}=await deriveSlipState(sql,input.betSlipId,input.result);
 let returned=asNumber(slip.returned);
 if(input.returned!==undefined)returned=Math.max(0,input.returned);
 else if(result==='loss')returned=0;
 else if(result==='push')returned=asNumber(slip.stake);
 else if(result==='win'){
  if(slip.potentialReturn!==null&&slip.potentialReturn!==undefined)returned=asNumber(slip.potentialReturn);
  else if(slip.combinedOdds)returned=asNumber(slip.stake)*decimal(Number(slip.combinedOdds));
  else throw new Error('winning wager needs returned amount, potential return, or combined odds');
 }
 const net=returned-asNumber(slip.stake);
 const isSettled=result!=='open';
 await sql`
  update bet_slips set result=${result},returned=${returned},net_pnl=${net},
   settled_at=${isSettled?settledAt:null},settlement_source=${input.source||'manual'},updated_at=now()
  where id=${input.betSlipId}
 `;
 if(before[0].result==='open'&&isSettled&&input.bankrollAccountId){
  await sql`update bankroll_accounts set current_bankroll=current_bankroll+${returned},updated_at=now() where id=${input.bankrollAccountId}`;
 }
 await sql`insert into ledger_events(bet_slip_id,event_type,source,payload) values(${input.betSlipId},'WAGER_SETTLED',${input.source||'manual'},${sql.json({result,returned,net,settledAt})})`;
 invalidateLedgerCache();
 return {ok:true,mode:'database' as const,betSlipId:input.betSlipId,result,returned,net};
}

export async function reconcileLedgerResults(results:any[]){
 const evidenceClasses:Record<string,number>={};
 for(const result of results){
  const evidenceClass=String(result?.settlementProvenance?.evidenceClass||'UNSPECIFIED');
  evidenceClasses[evidenceClass]=(evidenceClasses[evidenceClass]||0)+1;
 }
 const sql=db();
 if(!sql)return {
  matchedLegs:0,settledSlips:0,
  internalIdentityMatches:0,frozenSourceIdentityMatches:0,mappedSourceIdentityMatches:0,
  provenanceWritten:0,evidenceEvents:0,evidenceClasses,mode:'dry-run' as const
 };
 const affected=new Set<string>();
 let matchedLegs=0;
 let internalIdentityMatches=0;
 let frozenSourceIdentityMatches=0;
 let mappedSourceIdentityMatches=0;
 let provenanceWritten=0;
 let evidenceEvents=0;
 for(const result of results){
  if(!result?.eventId||!result?.selectionKey||!result?.result)continue;
  const rows=await sql`
   update bet_legs bl set
    result=${result.result},
    closing_odds=${result.closingOdds??null},
    settled_at=${result.settledAt??new Date().toISOString()}
   from bet_slips bs
   where bl.bet_slip_id=bs.id and bs.result='open'
    and (
     bl.event_id=${result.eventId}
     or nullif(bl.metadata->>'sourceEventId','')=${result.eventId}
     or exists(
      select 1 from events e
      where e.id=bl.event_id and nullif(e.provider_event_id,'')=${result.eventId}
     )
    )
    and lower(bl.selection)=lower(${result.selectionKey})
    and (${result.marketKey??null}::text is null or lower(bl.market_type)=lower(${result.marketKey??''}))
   returning
    bl.bet_slip_id as id,
    bl.ordinal,
    bl.event_id as "ledgerEventId",
    nullif(bl.metadata->>'sourceEventId','') as "sourceEventId"
  `;
  for(const row of rows as any[]){
   affected.add(String(row.id));
   matchedLegs++;
   if(String(row.ledgerEventId)===String(result.eventId))internalIdentityMatches++;
   else if(row.sourceEventId&&String(row.sourceEventId)===String(result.eventId))frozenSourceIdentityMatches++;
   else mappedSourceIdentityMatches++;
  }

  const provenance=result.settlementProvenance&&typeof result.settlementProvenance==='object'?result.settlementProvenance:null;
  if(provenance&&rows.length){
   const evidenceRows=await sql`
    update bet_legs bl set
     metadata=jsonb_set(
      coalesce(bl.metadata,'{}'::jsonb),
      '{settlementProvenance}',
      ${sql.json(provenance)}::jsonb,
      true
     )
    from bet_slips bs
    where bl.bet_slip_id=bs.id and bs.result='open'
     and (
      bl.event_id=${result.eventId}
      or nullif(bl.metadata->>'sourceEventId','')=${result.eventId}
      or exists(
       select 1 from events e
       where e.id=bl.event_id and nullif(e.provider_event_id,'')=${result.eventId}
      )
     )
     and lower(bl.selection)=lower(${result.selectionKey})
     and (${result.marketKey??null}::text is null or lower(bl.market_type)=lower(${result.marketKey??''}))
     and (bl.metadata->'settlementProvenance') is distinct from ${sql.json(provenance)}::jsonb
    returning
     bl.bet_slip_id as id,
     bl.ordinal,
     bl.event_id as "ledgerEventId",
     nullif(bl.metadata->>'sourceEventId','') as "sourceEventId"
   `;
   provenanceWritten+=evidenceRows.length;
   for(const row of evidenceRows as any[]){
    await sql`
     insert into ledger_events(bet_slip_id,event_type,source,payload)
     values(
      ${String(row.id)},
      'RESULT_EVIDENCE_APPLIED',
      ${String((provenance as any).source||'results-provider')},
      ${sql.json({
       ordinal:Number(row.ordinal),
       eventId:String(row.ledgerEventId||result.eventId),
       resultEventId:String(result.eventId),
       sourceEventId:row.sourceEventId?String(row.sourceEventId):null,
       identityMatch:String(row.ledgerEventId)===String(result.eventId)
        ?'INTERNAL_EVENT_ID'
        :row.sourceEventId&&String(row.sourceEventId)===String(result.eventId)
          ?'FROZEN_SOURCE_EVENT_ID'
          :'EVENT_PROVIDER_MAPPING',
       marketKey:String(result.marketKey||''),
       selectionKey:String(result.selectionKey),
       result:String(result.result),
       settledAt:String(result.settledAt||new Date().toISOString()),
       settlementProvenance:provenance
      })}
     )
    `;
    evidenceEvents++;
   }
  }
 }
 let settledSlips=0;
 for(const id of affected){
  const {result}=await deriveSlipState(sql,id);
  if(result==='open')continue;
  try{
   await settleWager({betSlipId:id,result,source:'results-provider'});
   settledSlips++;
  }catch{
   // A winning parlay without a known ticket price stays unfinalized rather than inventing a return.
  }
 }
 invalidateLedgerCache();
 return {
  matchedLegs,
  settledSlips,
  internalIdentityMatches,
  frozenSourceIdentityMatches,
  mappedSourceIdentityMatches,
  provenanceWritten,
  evidenceEvents,
  evidenceClasses,
  mode:'database' as const
 };
}
