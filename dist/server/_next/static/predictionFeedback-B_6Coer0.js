import{t as e}from"./db-9LtqYd6N.js";import{n as t}from"./settlementLearning-BNFvsZJn.js";import{o as n}from"./marketMovementLearning-Ce-G0UXL.js";async function r(r){let i=e();if(!i)return{written:0,matchedRuns:0,mode:`dry-run`};let a=0,o=0;for(let e of r){if(e.result===`push`)continue;let r=await i`
   select mr.id,mr.model_version as "modelVersion",mr.market_key as "marketKey",mr.selection_key as "selectionKey",mr.model_probability::float as "modelProbability",
    mr.feature_snapshot as "featureSnapshot",e.sport,e.start_time as "startTime",
    (
     select ms.american_odds
     from market_snapshots ms
     where ms.event_id=mr.event_id and ms.market_key=mr.market_key and ms.selection_key=mr.selection_key
     order by ms.pulled_at desc limit 1
    ) as "storedOdds"
   from model_runs mr
   left join events e on e.id=mr.event_id
   where mr.event_id=${e.eventId}
    and (${e.marketKey??null}::text is null or lower(mr.market_key)=lower(${e.marketKey??``}))
    and lower(mr.selection_key)=lower(${e.selectionKey})
   order by mr.created_at desc
   limit 1
  `;if(!r.length)continue;o++;let s=r[0],c=String(s.sport||`Unknown`),l=String(e.marketKey||s.marketKey||`Unknown`),u=Number(e.offeredOdds??s.featureSnapshot?.offeredOdds??s.storedOdds);if(!Number.isFinite(u)||u===0)continue;let d=e.closingOdds===void 0?await n(e.eventId,l,e.selectionKey||String(s.selectionKey||``)).catch(()=>null):null,f=Number.isFinite(Number(e.closingOdds))?Number(e.closingOdds):Number(d?.odds),p=Number.isFinite(f)&&f!==0?f:void 0,m=s.startTime?new Date(s.startTime).toISOString():e.settledAt||new Date().toISOString(),h=e.result===`win`?1:0,g=t(e.settlementProvenance),_=Array.isArray(s.featureSnapshot?.modelVotes)?s.featureSnapshot.modelVotes:[],v=[{name:`Model Council`,prob:Number(s.modelProbability)},..._.map(e=>({name:String(e.name||`Unknown`),prob:Number(e.prob)}))].filter(e=>Number.isFinite(e.prob)&&e.prob>0&&e.prob<1);for(let t of v){let n=[e.eventId,l,e.selectionKey,s.modelVersion,t.name].join(`|`),r=await i`
    insert into historical_predictions(
     occurred_at,sport,market_key,selection_key,model_name,model_version,
     predicted_probability,offered_odds,closing_odds,outcome,features,source_key
    ) values(
     ${m},${c},${l},${e.selectionKey},${t.name},
     ${s.modelVersion},${t.prob},${u},${p??null},
     ${h},${i.json({...s.featureSnapshot&&typeof s.featureSnapshot==`object`?s.featureSnapshot:{},modelRunId:Number(s.id),source:`settled-model-run`,simProbability:Number(s.featureSnapshot?.rawSimProbability??s.modelProbability),modelProbability:Number(s.modelProbability),closingLineSource:e.closingOdds===void 0?p===void 0?`missing`:`canonical-market-snapshots`:`results-provider`,settlementProvenance:e.settlementProvenance||null,settlementLearning:g})},${n}
    )
    on conflict do nothing
    returning id
   `;a+=r.length}}return{written:a,matchedRuns:o,mode:`database`}}export{r as t};