import{t as e}from"./db-9LtqYd6N.js";import{r as t}from"./playerWarehouse-BjX_GuwQ.js";var n=(e,t,n)=>Math.max(t,Math.min(n,e)),r=e=>e.toLowerCase().replace(/[^a-z0-9]+/g,``),i=e=>{let t=(e.market+` `+e.selection).toLowerCase();return t.includes(`under`)?`UNDER`:t.includes(`over`)?`OVER`:`OTHER`},a=e=>{if(e.playerContext?.statKey)return r(e.playerContext.statKey);let t=(e.market+` `+e.selection).toLowerCase();for(let[e,n]of[[/passing\s*yards?/,`passingyards`],[/passing\s*(tds?|touchdowns?)/,`passingtds`],[/rushing\s*yards?/,`rushingyards`],[/receiving\s*yards?/,`receivingyards`],[/receptions?/,`receptions`],[/pitch(?:er|ing).*strikeouts?|strikeouts?/,`strikeouts`],[/total\s*bases?/,`totalbases`],[/home\s*runs?/,`homeruns`],[/\brbi\b/,`rbi`],[/\bhits?\b/,`hits`],[/shots?\s*on\s*goal/,`shotsongoal`],[/\bsaves?\b/,`saves`],[/\bgoals?\b/,`goals`],[/\bpoints?\b/,`points`],[/rebounds?/,`rebounds`],[/assists?/,`assists`],[/\baces?\b/,`aces`],[/double\s*faults?/,`doublefaults`],[/games?\s*won/,`gameswon`],[/sets?\s*won/,`setswon`]])if(e.test(t))return n;return``};function o(e){let t=e.filter(e=>e.result===`win`||e.result===`loss`);if(!t.length)return null;let r=t.filter(e=>e.result===`win`).length,i=t.length-r,a=e.length-t.length,o=t.reduce((e,t)=>e+t.modelProbability,0)/t.length;r/t.length;let s=(r+o*12)/(t.length+12),c=s-o,l=n(t.length/40,0,1),u=n(c*l,-.06,.06),d=t.reduce((e,t)=>{let n=t.result===`win`?1:0;return e+(t.modelProbability-n)**2},0)/t.length,f=e[0];return{athleteId:f.athleteId,sport:f.sport,statKey:f.statKey,direction:f.direction,sampleSize:t.length,wins:r,losses:i,pushes:a,averageModelProbability:o,observedHitRate:s,calibrationBias:u,confidence:l,brierScore:d}}async function s(){let t=e();if(!t)return{configured:!1,rowsRead:0,profilesWritten:0,qualifiedProfiles:0};let r=await t`
  insert into player_calibration_runs(model_version)
  values(${process.env.MODEL_VERSION||`edgeforce-v61`})
  returning id
 `,i=Number(r[0]?.id||0),a=await t`
  select athlete_id as "athleteId",sport,coalesce(stat_key,'unknown') as "statKey",direction,
         coalesce(sim_probability,model_probability)::float as "modelProbability",result
  from player_prop_predictions
  where athlete_id is not null and result in ('win','loss','push')
  order by settled_at asc
 `,s=new Map;for(let e of a){let t={athleteId:String(e.athleteId),sport:String(e.sport),statKey:String(e.statKey),direction:String(e.direction),modelProbability:n(Number(e.modelProbability||.5),.01,.99),result:e.result},r=[t.athleteId,t.sport,t.statKey,t.direction].join(`|`),i=s.get(r)||[];i.push(t),s.set(r,i)}let c=0,l=0;for(let e of s.values()){let n=o(e);n&&(n.sampleSize>=8&&l++,await t`
   insert into player_calibration_profiles(
    athlete_id,sport,stat_key,direction,sample_size,wins,losses,pushes,
    average_model_probability,observed_hit_rate,calibration_bias,confidence,brier_score,updated_at,metadata
   ) values(
    ${n.athleteId},${n.sport},${n.statKey},${n.direction},${n.sampleSize},${n.wins},${n.losses},${n.pushes},
    ${n.averageModelProbability},${n.observedHitRate},${n.calibrationBias},${n.confidence},${n.brierScore},now(),
    ${t.json({shrinkagePrior:12,minRuntimeSample:8,maxBias:.06})}
   )
   on conflict (athlete_id,sport,stat_key,direction) do update set
    sample_size=excluded.sample_size,wins=excluded.wins,losses=excluded.losses,pushes=excluded.pushes,
    average_model_probability=excluded.average_model_probability,observed_hit_rate=excluded.observed_hit_rate,
    calibration_bias=excluded.calibration_bias,confidence=excluded.confidence,brier_score=excluded.brier_score,
    updated_at=now(),metadata=excluded.metadata
  `,c++)}return i&&await t`
  update player_calibration_runs
  set rows_read=${a.length},profiles_written=${c},qualified_profiles=${l},
      completed_at=now(),metadata=${t.json({groups:s.size})}
  where id=${i}
 `,{configured:!0,rowsRead:a.length,profilesWritten:c,qualifiedProfiles:l}}async function c(r){let o=e(),s=r.filter(e=>e.playerContext?.name);if(!o||!s.length)return{markets:r,matched:0,profiles:0};let c=await o`
  select id,normalized_name as "normalizedName"
  from athletes
  where normalized_name in ${o([...new Set(s.map(e=>t(e.playerContext.name)).filter(Boolean))])}
 `;if(!c.length)return{markets:r,matched:0,profiles:0};let l=new Map(c.map(e=>[String(e.normalizedName),String(e.id)])),u=await o`
  select athlete_id as "athleteId",sport,stat_key as "statKey",direction,
         sample_size as "sampleSize",calibration_bias::float as "calibrationBias",
         confidence::float as confidence,brier_score::float as "brierScore",
         observed_hit_rate::float as "observedHitRate",average_model_probability::float as "averageModelProbability"
  from player_calibration_profiles
  where athlete_id in ${o([...new Set([...l.values()])])}
 `,d=new Map;for(let e of u)d.set([e.athleteId,e.sport,e.statKey,e.direction].join(`|`),e);let f=0;return{markets:r.map(e=>{let r=e.playerContext;if(!r?.name)return e;let o=l.get(t(r.name));if(!o)return e;let s=a(e),c=i(e),u=d.get([o,e.sport,s,c].join(`|`));if(!u||Number(u.sampleSize)<8)return e;let p=n(Number(u.calibrationBias||0),-.06,.06),m=n(Number(u.confidence||0),0,1),h={...e.sportFeatures||{},playerCalibrationBias:p,playerCalibrationConfidence:m,playerCalibrationSample:Number(u.sampleSize||0),playerCalibrationBrier:Number(u.brierScore||0)},g=[...e.contextProvenance||[],{source:`player-calibration`,providerId:`edgeforce-player-calibration`,field:`player.`+s+`.`+c.toLowerCase()+`.calibration`,observedAt:new Date().toISOString(),confidence:.72+.25*m,status:`CACHED`,detail:{sampleSize:Number(u.sampleSize),bias:p,observedHitRate:Number(u.observedHitRate),averageModelProbability:Number(u.averageModelProbability)}}];return f++,{...e,sportFeatures:h,contextSources:[...new Set([...e.contextSources||[],`player-calibration`])],contextProvenance:g}}),matched:f,profiles:u.length}}async function l(){let t=e();if(!t)return{configured:!1,totalProfiles:0,qualifiedProfiles:0,totalSamples:0,top:[]};let[n,r]=await Promise.all([t`
   select count(*)::int as "totalProfiles",
          count(*) filter(where sample_size>=8)::int as "qualifiedProfiles",
          coalesce(sum(sample_size),0)::int as "totalSamples"
   from player_calibration_profiles
  `,t`
   select a.name as "playerName",p.sport,p.stat_key as "statKey",p.direction,
          p.sample_size as "sampleSize",p.observed_hit_rate::float as "observedHitRate",
          p.average_model_probability::float as "averageModelProbability",
          p.calibration_bias::float as "calibrationBias",p.confidence::float as confidence,p.brier_score::float as "brierScore"
   from player_calibration_profiles p
   join athletes a on a.id=p.athlete_id
   where p.sample_size>=8
   order by abs(p.calibration_bias) desc,p.sample_size desc
   limit 30
  `]),i=n[0]||{};return{configured:!0,totalProfiles:Number(i.totalProfiles||0),qualifiedProfiles:Number(i.qualifiedProfiles||0),totalSamples:Number(i.totalSamples||0),top:r}}export{s as i,c as n,l as r,o as t};