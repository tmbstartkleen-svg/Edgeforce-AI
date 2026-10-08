import{t as e}from"./db-9LtqYd6N.js";async function t(t){let n=e();if(!n)return{written:0,mode:`memory`};let r=0,i=e=>n.json(e);for(let e of t)await n`
   insert into decision_journal(market_id,event_id,action,reasons,before_state,after_state,metadata)
   values(${e.marketId??null},${e.eventId??null},${e.action},${i(e.reason)},${i(e.before||{})},${i(e.after||{})},${i(e.metadata||{})})
  `,r++;return{written:r,mode:`database`}}export{t};