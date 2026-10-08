import{t as e}from"./db-9LtqYd6N.js";function t(e,t){if(!t)return{...e,lifecycleState:`NEW`,priorMasterScore:null,priorEdge:null,scoreDelta:null,edgeDelta:null,ageMinutes:null,actionLabel:`WATCH`,reason:`Newly surfaced opportunity with no recent comparable snapshot.`};let n=e.masterScore-Number(t.master_score),r=e.edge-Number(t.edge),i=Math.max(0,(Date.now()-new Date(t.generated_at).getTime())/6e4),a=`STABLE`,o=`WATCH`,s=`Opportunity remains broadly stable versus the prior snapshot.`;return e.masterScore<.5||Math.abs(e.edge)<.01?(a=`DECAYED`,o=`REMOVE`,s=`Master score or model-market edge fell below the lifecycle floor.`):n>=.035||Math.abs(e.edge)>=Math.abs(Number(t.edge))+.02?(a=`STRENGTHENING`,o=`RECHECK`,s=`Master score or model-market gap improved materially since the prior snapshot.`):(n<=-.035||Math.abs(e.edge)+.02<=Math.abs(Number(t.edge)))&&(a=`WEAKENING`,o=`HOLD`,s=`Master score or model-market gap weakened materially since the prior snapshot.`),{...e,lifecycleState:a,priorMasterScore:Number(t.master_score),priorEdge:Number(t.edge),scoreDelta:n,edgeDelta:r,ageMinutes:i,actionLabel:o,reason:s}}async function n(n){let r=e();if(!r)return{generatedAt:new Date().toISOString(),configured:!1,rows:n.map(e=>t(e,null)),exits:[],persisted:!1};let i=n.map(e=>e.id),a=i.length?await r`
  select distinct on (opportunity_id)
   opportunity_id,master_score::float8,edge::float8,generated_at
  from master_edge_snapshots
  where opportunity_id = any(${i})
   and generated_at >= now() - interval '24 hours'
  order by opportunity_id,generated_at desc
 `:[],o=new Map(a.map(e=>[String(e.opportunity_id),e])),s=n.map(e=>t(e,o.get(e.id)||null)),c=await r`
  select distinct on (opportunity_id)
   opportunity_id,domain,category,venue,title,model_probability::float8,market_probability::float8,
   edge::float8,confidence::float8,router_weight::float8,liquidity_score::float8,
   freshness_score::float8,master_score::float8,tier,metadata,generated_at
  from master_edge_snapshots
  where generated_at >= now() - interval '6 hours'
  order by opportunity_id,generated_at desc
  limit 500
 `,l=new Set(i),u=c.filter(e=>!l.has(String(e.opportunity_id))).filter(e=>Number(e.master_score)>=.58).slice(0,40).map(e=>({id:String(e.opportunity_id),domain:String(e.domain)===`MARKETS`?`MARKETS`:`SPORTS`,category:String(e.category),venue:String(e.venue||``),title:String(e.title),modelProbability:Number(e.model_probability),marketProbability:Number(e.market_probability),edge:Number(e.edge),confidence:Number(e.confidence),routerWeight:Number(e.router_weight),liquidityScore:Number(e.liquidity_score),freshnessScore:Number(e.freshness_score),masterScore:Number(e.master_score),tier:String(e.tier),sourceType:String(e.domain)===`MARKETS`?`PREDICTION_MARKET`:`SPORTSBOOK`,metadata:e.metadata||{},lifecycleState:`EXIT`,priorMasterScore:Number(e.master_score),priorEdge:Number(e.edge),scoreDelta:null,edgeDelta:null,ageMinutes:Math.max(0,(Date.now()-new Date(e.generated_at).getTime())/6e4),actionLabel:`REMOVE`,reason:`Previously qualified opportunity no longer appears on the current Master Edge board.`})),d=await r`select max(generated_at) as latest from master_edge_snapshots`,f=d[0]?.latest?new Date(d[0].latest).getTime():0,p=!f||Date.now()-f>=5*6e4;if(p&&n.length){for(let e of n)await r`
    insert into master_edge_snapshots(
     generated_at,opportunity_id,domain,category,venue,title,model_probability,market_probability,edge,confidence,router_weight,liquidity_score,freshness_score,master_score,tier,metadata
    ) values(
     now(),${e.id},${e.domain},${e.category},${e.venue},${e.title},${e.modelProbability},${e.marketProbability},${e.edge},${e.confidence},${e.routerWeight},${e.liquidityScore},${e.freshnessScore},${e.masterScore},${e.tier},${r.json(e.metadata)}
    )
   `;for(let e of[...s,...u].filter(e=>e.lifecycleState!==`STABLE`))await r`
    insert into edge_lifecycle_events(
     observed_at,opportunity_id,domain,category,venue,lifecycle_state,action_label,master_score,prior_master_score,edge,prior_edge,score_delta,edge_delta,reason,metadata
    ) values(
     now(),${e.id},${e.domain},${e.category},${e.venue},${e.lifecycleState},${e.actionLabel},${e.masterScore},${e.priorMasterScore},${e.edge},${e.priorEdge},${e.scoreDelta},${e.edgeDelta},${e.reason},${r.json(e.metadata)}
    )
   `}return{generatedAt:new Date().toISOString(),configured:!0,rows:s,exits:u,persisted:p&&n.length>0}}export{n as t};