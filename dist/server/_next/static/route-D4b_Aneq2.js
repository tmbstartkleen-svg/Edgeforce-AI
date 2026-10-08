import{t as e}from"./db-9LtqYd6N.js";import"./automationHealth-BEUnKhvu.js";import{t}from"./demo-CvfXeG8E.js";import"./modelGovernance-DERBcsy-.js";import"./validationLab-CpfyTMQ0.js";import{n}from"./learnedWeights-BG8kt-l2.js";import{t as r}from"./modelCouncil-nbPr2v_W.js";import"./engine-DfC5SdvQ.js";import"./crossSportOptimizer-CT9Cmvuj.js";import"./unifiedIntelligence-DGsP4XNR.js";import"./intelligenceReliability-D7V1i5-w.js";import{r as i}from"./regimeConfidence-BQ3CLQ61.js";import{t as a}from"./scanner-CRSbaDSq.js";import{n as o}from"./explainability-DFgFApsu.js";async function s(s,{params:c}){let{id:l}=await c,{searchParams:u}=new URL(s.url),d=u.get(`market`),f=u.get(`selection`),[p,m]=await Promise.all([n(),i()]),h=e();if(!h){let e=t.find(e=>e.id===l&&(!d||e.market===d)&&(!f||e.selection===f))||t.find(e=>e.id===l)||null;return Response.json({source:`demo`,market:e,council:e?r(e,p):null,explanation:e?o(e,p):null,scan:e?a([e],`Moderate`,new Date,p,m):[]})}let g=(await h`
  select distinct on (ms.event_id,ms.market_key,ms.selection_key)
   ms.event_id as id,e.sport,e.league,
   coalesce(e.away_team_id,'Away') || ' @ ' || coalesce(e.home_team_id,'Home') as event,
   ms.selection_key as selection,ms.market_key as market,e.start_time as "startTime",
   coalesce(e.home_team_id,'Home') as home,coalesce(e.away_team_id,'Away') as away,
   ms.american_odds as odds,
   ms.implied_probability::float as "rawImpliedProb",
   coalesce(ms.raw->>'sourceBook',ms.bookmaker) as "sourceBook",
   coalesce(ms.raw->>'sourceProviderId',ms.provider) as "sourceProviderId",
   ms.raw->'consensus' as consensus,
   coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "marketProb",
   coalesce((ms.raw->>'modelProb')::float,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float) as "modelProb",
   coalesce((ms.raw->>'confidence')::float,0.6) as confidence,
   greatest(0,extract(epoch from (now()-ms.pulled_at))/60)::float as "sourceAgeMin",
   case when extract(hour from e.start_time at time zone 'America/Chicago')<12 then 'AM' else 'PM' end as period,
   coalesce(ms.raw->'sportFeatures','{}'::jsonb) as "sportFeatures",
   coalesce(ms.raw->'contextSources','[]'::jsonb) as "contextSources",
   ms.raw->'playerContext' as "playerContext"
  from market_snapshots ms join events e on e.id=ms.event_id
  where ms.event_id=${l}
   and (${d}::text is null or lower(ms.market_key)=lower(${d??``}))
   and (${f}::text is null or lower(ms.selection_key)=lower(${f??``}))
  order by ms.event_id,ms.market_key,ms.selection_key,ms.pulled_at desc
  limit 1
 `)[0]||null;return Response.json({source:`database`,market:g,council:g?r(g,p):null,explanation:g?o(g,p):null,scan:g?a([g],`Moderate`,new Date,p,m):[]})}export{s as GET};