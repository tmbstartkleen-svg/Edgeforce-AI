import{t as e}from"./db-9LtqYd6N.js";import{t}from"./lineMovement-OCYGnOHi.js";import{randomUUID as n}from"node:crypto";var r=[{id:`baseline-2026-09-29`,placedAt:`2026-09-29T12:00:00-04:00`,source:`baseline`,confidence:`confirmed`,sport:`All`,legCount:0,stake:25,paid:32,result:`win`,settledAt:`2026-09-29T23:59:59-04:00`,legs:[],notes:`Correct starting baseline supplied by user: $25 staked, $32 returned, +$7 net profit, +28% ROI.`},{id:`2026-09-30-tennis-djokovic-gea`,placedAt:`2026-09-30T03:24:41-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Tennis`,legCount:2,stake:71.98,paid:122,result:`win`,legs:[{label:`Novak Djokovic to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Arthur Gea to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`}]},{id:`2026-09-30-tennis-four-a`,placedAt:`2026-09-30T04:36:22-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Tennis`,legCount:4,stake:4.8,paid:12,result:`win`,legs:[{label:`Novak Djokovic to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Arthur Gea to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Carlos Alcaraz to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Frances Tiafoe to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`}]},{id:`2026-09-30-tennis-dart-rakhimova`,placedAt:`2026-09-30T05:07:12-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Tennis`,legCount:2,stake:7.59,paid:11,result:`win`,legs:[{label:`Harriet Dart to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Kamilla Rakhimova to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`}]},{id:`2026-09-30-mlb-alt-runline`,placedAt:`2026-09-30T05:00:40-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`MLB`,legCount:2,stake:6.96,paid:12,result:`win`,legs:[{label:`NY Yankees +2.5`,sport:`MLB`,marketType:`Run Line`,result:`win`},{label:`SD Padres +1.5`,sport:`MLB`,marketType:`Run Line`,result:`win`}]},{id:`2026-09-30-tennis-zheng-demin`,placedAt:`2026-09-30T11:03:04-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Tennis`,legCount:2,stake:280.09,paid:374,result:`win`,legs:[{label:`Qinwen Zheng to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Alex De Minaur to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`}]},{id:`2026-09-30-prediction-bitcoin`,placedAt:`2026-09-30T10:51:40-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Prediction Market`,legCount:1,stake:6.41,paid:9,result:`win`,legs:[{label:`Bitcoin above $83,670.07 at 10:55 AM ET`,sport:`Prediction Market`,marketType:`Binary`,result:`win`}]},{id:`2026-09-30-tennis-dart-demin`,placedAt:`2026-09-30T09:27:39-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Tennis`,legCount:2,stake:49.4,paid:65,result:`win`,legs:[{label:`Harriet Dart to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Alex De Minaur to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`}]},{id:`2026-09-30-tennis-four-b`,placedAt:`2026-09-30T05:12:39-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Tennis`,legCount:4,stake:15.99,paid:39,result:`win`,legs:[{label:`Harriet Dart to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Arthur Gea to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Kamilla Rakhimova to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Novak Djokovic to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`}]},{id:`2026-09-30-tennis-four-c`,placedAt:`2026-09-30T05:10:10-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`Tennis`,legCount:4,stake:10,paid:25,result:`win`,legs:[{label:`Harriet Dart to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Arthur Gea to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Novak Djokovic to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`},{label:`Magdalena Frech to win`,sport:`Tennis`,marketType:`Moneyline`,result:`win`}]},{id:`2026-09-30-mlb-four-loss`,placedAt:`2026-09-30T04:51:45-04:00`,source:`uploaded-screenshot`,confidence:`partial`,sport:`MLB`,legCount:4,stake:5,paid:0,result:`loss`,legs:[{label:`PHI Phillies to win`,sport:`MLB`,marketType:`Moneyline`,result:`unknown`},{label:`HOU Astros to win`,sport:`MLB`,marketType:`Moneyline`,result:`unknown`},{label:`NY Yankees to win`,sport:`MLB`,marketType:`Moneyline`,result:`unknown`},{label:`SD Padres to win`,sport:`MLB`,marketType:`Moneyline`,result:`unknown`}],notes:`Slip result is visible, but the losing leg is not shown in the uploaded frame.`},{id:`2026-09-30-wnba-two-loss`,placedAt:`2026-09-30T11:55:10-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`WNBA`,legCount:2,stake:9.84,paid:0,result:`loss`,legs:[{label:`ATL Dream to win`,sport:`WNBA`,marketType:`Moneyline`,result:`win`},{label:`GS Valkyries to win`,sport:`WNBA`,marketType:`Moneyline`,result:`loss`}]},{id:`2026-09-30-wnba-three-loss`,placedAt:`2026-09-30T04:25:42-04:00`,source:`uploaded-screenshot`,confidence:`partial`,sport:`WNBA`,legCount:3,stake:3.91,paid:0,result:`loss`,legs:[{label:`GS Valkyries to win`,sport:`WNBA`,marketType:`Moneyline`,result:`unknown`},{label:`LV Aces to win`,sport:`WNBA`,marketType:`Moneyline`,result:`unknown`},{label:`ATL Dream to win`,sport:`WNBA`,marketType:`Moneyline`,result:`unknown`}]},{id:`2026-09-30-nhl-avs-flyers-loss`,placedAt:`2026-09-30T04:26:44-04:00`,source:`uploaded-screenshot`,confidence:`partial`,sport:`NHL`,legCount:2,stake:4,paid:0,result:`loss`,legs:[{label:`COL Avalanche moneyline`,sport:`NHL`,marketType:`Moneyline`,result:`unknown`},{label:`PHI Flyers moneyline`,sport:`NHL`,marketType:`Moneyline`,result:`unknown`}]},{id:`2026-09-30-nhl-avs-total-loss`,placedAt:`2026-09-30T11:53:36-04:00`,source:`uploaded-screenshot`,confidence:`confirmed`,sport:`NHL`,legCount:2,stake:10,paid:0,result:`loss`,legs:[{label:`COL Avalanche moneyline`,sport:`NHL`,marketType:`Moneyline`,result:`win`},{label:`NYI @ TOR over 5.5 goals`,sport:`NHL`,marketType:`Total`,result:`loss`}]}],i=e=>e>0?1+e/100:1+100/Math.abs(e),a=(e,t=0)=>typeof e==`number`?e:Number(e??t),o=e=>{let t=a(e,NaN);return Number.isFinite(t)?Math.max(0,Math.min(1,t)):void 0},s=null,c=3e3;function l(){s=null}async function u(){if(s&&Date.now()-s.at<c)return s.rows;let t=e();if(!t)return s={at:Date.now(),rows:r},r;try{let e=await t`
   select id,placed_at as "placedAt",source,confidence,sport,leg_count as "legCount",
    stake::float,returned::float,result,notes,combined_odds as "combinedOdds",
    model_probability::float as "modelProbability",settled_at as "settledAt"
   from bet_slips
   order by placed_at asc
  `,n=await t`
   select bet_slip_id as "betSlipId",ordinal,sport,market_type as "marketType",
    selection as label,result,offered_odds as "offeredOdds",event_id as "eventId",
    event_label as event,model_probability::float as "modelProbability",
    closing_odds as "closingOdds",clv_probability::float as clv
   from bet_legs
   order by bet_slip_id,ordinal
  `,i=new Map;for(let e of n){let t=i.get(e.betSlipId)||[];t.push({label:String(e.label),sport:String(e.sport||`Unknown`),marketType:String(e.marketType||`Unknown`),result:e.result||`unknown`,offeredOdds:e.offeredOdds??void 0,closingOdds:e.closingOdds??void 0,clv:Number.isFinite(Number(e.clv))?Number(e.clv):void 0,eventId:e.eventId??void 0,event:e.event??void 0,modelProbability:o(e.modelProbability)}),i.set(e.betSlipId,t)}let c=e.map(e=>({id:String(e.id),placedAt:new Date(e.placedAt).toISOString(),source:e.source||`api`,confidence:e.confidence||`confirmed`,sport:String(e.sport||`Mixed`),legCount:Number(e.legCount||0),stake:a(e.stake),paid:a(e.returned),result:e.result||`open`,combinedOdds:e.combinedOdds??void 0,modelProbability:o(e.modelProbability),settledAt:e.settledAt?new Date(e.settledAt).toISOString():void 0,legs:i.get(String(e.id))||[],notes:e.notes??void 0})),l=new Map(r.map(e=>[e.id,e]));for(let e of c)l.set(e.id,e);let u=[...l.values()].sort((e,t)=>new Date(e.placedAt).getTime()-new Date(t.placedAt).getTime());return s={at:Date.now(),rows:u},u}catch{return s={at:Date.now(),rows:r},r}}async function d(t=100){let n=e(),r=Math.max(1,Math.min(500,Math.floor(Number(t)||100)));if(!n)return{mode:`dry-run`,rows:[],count:0,evidenceClasses:{}};let i=(await n`
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
  limit ${r}
 `).map(e=>({id:Number(e.id),betSlipId:e.betSlipId?String(e.betSlipId):null,source:e.source?String(e.source):null,createdAt:e.createdAt?new Date(e.createdAt).toISOString():null,ordinal:e.ordinal==null?null:Number(e.ordinal),sport:e.sport?String(e.sport):null,marketType:e.marketType?String(e.marketType):null,selection:e.selection?String(e.selection):null,eventId:e.eventId?String(e.eventId):null,result:e.result?String(e.result):null,settledAt:e.settledAt?new Date(e.settledAt).toISOString():null,settlementProvenance:e.legProvenance||e.payload?.settlementProvenance||null,payload:e.payload||{}})),a={};for(let e of i){let t=String(e.settlementProvenance?.evidenceClass||`UNSPECIFIED`);a[t]=(a[t]||0)+1}return{mode:`database`,rows:i,count:i.length,evidenceClasses:a}}async function f(t){if(!Number.isFinite(t.stake)||t.stake<=0)throw Error(`stake must be greater than zero`);if(!Array.isArray(t.legs)||!t.legs.length)throw Error(`at least one leg is required`);let r=e(),a=t.id||n(),o=t.placedAt||new Date().toISOString(),s=t.potentialReturn??(t.combinedOdds?t.stake*i(t.combinedOdds):void 0);if(!r)return{ok:!0,mode:`dry-run`,id:a,potentialReturn:s};let c=await r`select id,result from bet_slips where id=${a} limit 1`;await r`
  insert into bet_slips(
   id,placed_at,source,confidence,sport,leg_count,stake,returned,result,notes,raw,
   sportsbook,combined_odds,potential_return,model_probability,net_pnl,updated_at
  ) values(
   ${a},${o},${t.source||`manual`},${t.confidence||`confirmed`},
   ${t.sport||[...new Set(t.legs.map(e=>e.sport))].join(` + `)},
   ${t.legs.length},${t.stake},0,'open',${t.notes??null},'{}'::jsonb,
   ${t.sportsbook||`DraftKings`},${t.combinedOdds??null},${s??null},
   ${t.modelProbability??null},0,now()
  )
  on conflict (id) do update set
   placed_at=excluded.placed_at,source=excluded.source,confidence=excluded.confidence,
   sport=excluded.sport,leg_count=excluded.leg_count,stake=excluded.stake,notes=excluded.notes,
   sportsbook=excluded.sportsbook,combined_odds=excluded.combined_odds,
   potential_return=excluded.potential_return,model_probability=excluded.model_probability,updated_at=now()
 `,await r`delete from bet_legs where bet_slip_id=${a}`;for(let e=0;e<t.legs.length;e++){let n=t.legs[e];await r`
   insert into bet_legs(
    bet_slip_id,ordinal,sport,market_type,selection,result,offered_odds,event_id,event_label,
    model_probability,raw_implied_probability,no_vig_probability,prediction_market_probability,metadata
   ) values(
    ${a},${n.ordinal??e+1},${n.sport},${n.marketType},${n.label},'unknown',
    ${n.offeredOdds??null},${n.eventId??null},${n.event??null},${n.modelProbability??null},
    ${n.rawImpliedProbability??null},${n.noVigProbability??null},
    ${n.predictionMarketProbability??null},'{}'::jsonb
   )
  `}return!c.length&&t.bankrollAccountId&&await r`update bankroll_accounts set current_bankroll=current_bankroll-${t.stake},updated_at=now() where id=${t.bankrollAccountId}`,await r`insert into ledger_events(bet_slip_id,event_type,source,payload) values(${a},'WAGER_RECORDED',${t.source||`manual`},${r.json({stake:t.stake,combinedOdds:t.combinedOdds,potentialReturn:s,legCount:t.legs.length})})`,l(),{ok:!0,mode:`database`,id:a,potentialReturn:s}}async function p(e,t,n){let[r]=await e`select id,stake::float,returned::float,result,combined_odds as "combinedOdds",potential_return::float as "potentialReturn" from bet_slips where id=${t} limit 1`;if(!r)throw Error(`bet slip not found`);let i=(await e`select result from bet_legs where bet_slip_id=${t} order by ordinal`).map(e=>String(e.result)),a=n;return a||=i.some(e=>e===`loss`)?`loss`:i.length&&i.every(e=>e===`push`)?`push`:i.length&&i.every(e=>e===`win`||e===`push`)?`win`:`open`,{slip:r,result:a}}async function m(n){let r=e();if(!r)return{ok:!0,mode:`dry-run`,betSlipId:n.betSlipId};let o=await r`select result from bet_slips where id=${n.betSlipId} limit 1`;if(!o.length)throw Error(`bet slip not found`);let s=n.settledAt||new Date().toISOString();for(let e of n.legs||[])e.ordinal===void 0?e.eventId&&e.selection&&await r`
    update bet_legs set result=${e.result},closing_odds=${e.closingOdds??null},
     settled_at=case when ${e.result}='unknown' then null else ${s}::timestamptz end
    where bet_slip_id=${n.betSlipId} and event_id=${e.eventId}
     and lower(selection)=lower(${e.selection})
     and (${e.marketType??null}::text is null or lower(market_type)=lower(${e.marketType??``}))
   `:await r`
    update bet_legs set result=${e.result},closing_odds=${e.closingOdds??null},
     settled_at=case when ${e.result}='unknown' then null else ${s}::timestamptz end
    where bet_slip_id=${n.betSlipId} and ordinal=${e.ordinal}
   `;await t(n.betSlipId).catch(()=>0);let{slip:c,result:u}=await p(r,n.betSlipId,n.result),d=a(c.returned);if(n.returned!==void 0)d=Math.max(0,n.returned);else if(u===`loss`)d=0;else if(u===`push`)d=a(c.stake);else if(u===`win`)if(c.potentialReturn!==null&&c.potentialReturn!==void 0)d=a(c.potentialReturn);else if(c.combinedOdds)d=a(c.stake)*i(Number(c.combinedOdds));else throw Error(`winning wager needs returned amount, potential return, or combined odds`);let f=d-a(c.stake),m=u!==`open`;return await r`
  update bet_slips set result=${u},returned=${d},net_pnl=${f},
   settled_at=${m?s:null},settlement_source=${n.source||`manual`},updated_at=now()
  where id=${n.betSlipId}
 `,o[0].result===`open`&&m&&n.bankrollAccountId&&await r`update bankroll_accounts set current_bankroll=current_bankroll+${d},updated_at=now() where id=${n.bankrollAccountId}`,await r`insert into ledger_events(bet_slip_id,event_type,source,payload) values(${n.betSlipId},'WAGER_SETTLED',${n.source||`manual`},${r.json({result:u,returned:d,net:f,settledAt:s})})`,l(),{ok:!0,mode:`database`,betSlipId:n.betSlipId,result:u,returned:d,net:f}}async function h(t){let n={};for(let e of t){let t=String(e?.settlementProvenance?.evidenceClass||`UNSPECIFIED`);n[t]=(n[t]||0)+1}let r=e();if(!r)return{matchedLegs:0,settledSlips:0,provenanceWritten:0,evidenceEvents:0,evidenceClasses:n,mode:`dry-run`};let i=new Set,a=0,o=0,s=0;for(let e of t){if(!e?.eventId||!e?.selectionKey||!e?.result)continue;let t=await r`
   update bet_legs bl set
    result=${e.result},
    closing_odds=${e.closingOdds??null},
    settled_at=${e.settledAt??new Date().toISOString()}
   from bet_slips bs
   where bl.bet_slip_id=bs.id and bs.result='open'
    and bl.event_id=${e.eventId}
    and lower(bl.selection)=lower(${e.selectionKey})
    and (${e.marketKey??null}::text is null or lower(bl.market_type)=lower(${e.marketKey??``}))
   returning bl.bet_slip_id as id,bl.ordinal
  `;for(let e of t)i.add(String(e.id)),a++;let n=e.settlementProvenance&&typeof e.settlementProvenance==`object`?e.settlementProvenance:null;if(n&&t.length){let t=await r`
    update bet_legs bl set
     metadata=jsonb_set(
      coalesce(bl.metadata,'{}'::jsonb),
      '{settlementProvenance}',
      ${r.json(n)}::jsonb,
      true
     )
    from bet_slips bs
    where bl.bet_slip_id=bs.id and bs.result='open'
     and bl.event_id=${e.eventId}
     and lower(bl.selection)=lower(${e.selectionKey})
     and (${e.marketKey??null}::text is null or lower(bl.market_type)=lower(${e.marketKey??``}))
     and (bl.metadata->'settlementProvenance') is distinct from ${r.json(n)}::jsonb
    returning bl.bet_slip_id as id,bl.ordinal
   `;o+=t.length;for(let i of t)await r`
     insert into ledger_events(bet_slip_id,event_type,source,payload)
     values(
      ${String(i.id)},
      'RESULT_EVIDENCE_APPLIED',
      ${String(n.source||`results-provider`)},
      ${r.json({ordinal:Number(i.ordinal),eventId:String(e.eventId),marketKey:String(e.marketKey||``),selectionKey:String(e.selectionKey),result:String(e.result),settledAt:String(e.settledAt||new Date().toISOString()),settlementProvenance:n})}
     )
    `,s++}}let c=0;for(let e of i){let{result:t}=await p(r,e);if(t!==`open`)try{await m({betSlipId:e,result:t,source:`results-provider`}),c++}catch{}}return l(),{matchedLegs:a,settledSlips:c,provenanceWritten:o,evidenceEvents:s,evidenceClasses:n,mode:`database`}}export{m as a,f as i,d as n,h as r,u as t};