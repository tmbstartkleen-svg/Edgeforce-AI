import{t as e}from"./db-9LtqYd6N.js";import{t}from"./cashout-DAsR6BvJ.js";var n=(e,t=0,n=1)=>Math.max(t,Math.min(n,e)),r=e=>e.length?e.reduce((e,t)=>e+t,0)/e.length:0;function i(e){let r=t({stake:Number(e.stake),originalOdds:Number(e.original_odds),currentWinProbability:Number(e.current_win_probability),cashoutOffer:Number(e.cashout_offer)}),i=e.outcome===`WON`?Number(e.final_payout??r.grossIfWin):e.outcome===`VOID`?Number(e.stake):0;if(e.outcome===`PENDING`||!e.outcome)return null;let a=e.action===`CASH_OUT`?Number(e.cashout_offer):e.action===`HOLD`?i:null;if(a===null)return null;let o=e.action===`CASH_OUT`?i:Number(e.cashout_offer),s=Math.max(1,Number(e.stake));return n(.5+(a-o)/(2*s))}async function a(n){let r=e();if(!r)return{configured:!1,written:!1};let i=t({stake:n.stake,originalOdds:n.originalOdds,currentWinProbability:n.currentWinProbability,cashoutOffer:n.cashoutOffer});if(n.observationId){let e=await r`
   update cashout_observations set
    event_key=coalesce(${n.eventKey??null},event_key),
    command_id=coalesce(${n.commandId??null},command_id),
    ladder_id=coalesce(${n.ladderId??null},ladder_id),
    checkpoint_label=coalesce(${n.checkpointLabel??null},checkpoint_label),
    stake=${n.stake},original_odds=${n.originalOdds},current_win_probability=${n.currentWinProbability},
    cashout_offer=${n.cashoutOffer},model_hold_value=${i.adjustedHold},model_cashout_edge=${i.cashoutEdge},
    model_decision=${i.decision},user_action=${n.action},outcome=${n.outcome??`PENDING`},
    final_payout=${n.finalPayout??null},sportsbook=coalesce(${n.sportsbook??null},sportsbook),
    metadata=${r.json(n.metadata||{})},updated_at=now()
   where id=${n.observationId}
   returning id
  `;return{configured:!0,written:e.length>0,observationId:e[0]?.id??n.observationId,model:i}}return{configured:!0,written:!0,observationId:(await r`
  insert into cashout_observations(
   event_key,command_id,ladder_id,checkpoint_label,stake,original_odds,current_win_probability,cashout_offer,
   model_hold_value,model_cashout_edge,model_decision,user_action,outcome,final_payout,sportsbook,metadata,updated_at
  ) values(
   ${n.eventKey??null},${n.commandId??null},${n.ladderId??null},${n.checkpointLabel??null},${n.stake},${n.originalOdds},${n.currentWinProbability},${n.cashoutOffer},
   ${i.adjustedHold},${i.cashoutEdge},${i.decision},${n.action},${n.outcome??`PENDING`},${n.finalPayout??null},${n.sportsbook??null},${r.json(n.metadata||{})},now()
  ) returning id
 `)[0]?.id??null,model:i}}async function o(){let t=e();if(!t)return{configured:!1,rows:[],pending:0};let a=await t`
  select command_id,checkpoint_label,stake::float8,original_odds,current_win_probability::float8,cashout_offer::float8,
   model_cashout_edge::float8,user_action,outcome,final_payout::float8,created_at
  from cashout_observations
  where created_at >= now() - interval '90 days'
  order by created_at desc
  limit 10000
 `,o=a.map(e=>e.command_id).filter(Boolean),s=o.length?await t`
  select command_id,command_type
  from opportunity_command_queue
  where command_id = any(${o})
  order by observed_at desc
 `:[],c=new Map;for(let e of s)c.has(String(e.command_id))||c.set(String(e.command_id),String(e.command_type));let l=new Map,u=0;for(let e of a){let t=c.get(String(e.command_id||``)),n=String(e.checkpoint_label||``).toLowerCase().includes(`final`),r=t===`FINAL_LEG_REVIEW`||!t&&n?`FINAL_LEG_REVIEW`:`CASHOUT_REVIEW`,a=l.get(r)||{utility:[],edge:[],samples:0,graded:0,positive:0};a.samples++,a.edge.push(Number(e.model_cashout_edge||0));let o=i({stake:Number(e.stake),original_odds:Number(e.original_odds),cashout_offer:Number(e.cashout_offer),action:String(e.user_action),outcome:e.outcome?String(e.outcome):null,final_payout:e.final_payout===null?null:Number(e.final_payout),current_win_probability:Number(e.current_win_probability)});if(o===null){u++,l.set(r,a);continue}a.graded++,a.utility.push(o),o>=.6&&a.positive++,l.set(r,a)}return{configured:!0,rows:[`CASHOUT_REVIEW`,`FINAL_LEG_REVIEW`].map(e=>{let t=l.get(e)||{utility:[],edge:[],samples:0,graded:0,positive:0},i=t.graded?t.positive/t.graded:0,a=r(t.utility),o=r(t.edge),s=n(t.graded/60);if(t.graded<8)return{alertType:e,samples:t.samples,gradedSamples:t.graded,positiveSamples:t.positive,positiveRate:i,averageDecisionUtility:a,averageOfferEdge:o,confidence:s,multiplier:1,state:`UNSCORED`};let c=t.graded/(t.graded+40),u=.95+n(.5+(a-.5)*2*c*.5)*.1,d=u>=1.02?`BOOST`:u<=.98?`REDUCE`:`NEUTRAL`;return{alertType:e,samples:t.samples,gradedSamples:t.graded,positiveSamples:t.positive,positiveRate:i,averageDecisionUtility:a,averageOfferEdge:o,confidence:s,multiplier:u,state:d}}),pending:u}}async function s(t){let n=e();if(!n||!t.length)return{persisted:!1};let r=await n`select max(observed_at) as latest from cashout_learning_snapshots`,i=r[0]?.latest?new Date(r[0].latest).getTime():0;if(i&&Date.now()-i<15*6e4)return{persisted:!1};for(let e of t)await n`
   insert into cashout_learning_snapshots(
    observed_at,alert_type,samples,graded_samples,positive_samples,positive_rate,average_decision_utility,average_offer_edge,confidence,multiplier,state,metadata
   ) values(
    now(),${e.alertType},${e.samples},${e.gradedSamples},${e.positiveSamples},${e.positiveRate},${e.averageDecisionUtility},${e.averageOfferEdge},${e.confidence},${e.multiplier},${e.state},${n.json({})}
   )
  `;return{persisted:!0}}export{s as n,a as r,o as t};