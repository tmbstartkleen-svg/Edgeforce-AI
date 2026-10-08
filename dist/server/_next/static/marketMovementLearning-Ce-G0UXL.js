import{t as e}from"./db-9LtqYd6N.js";import{i as t,n}from"./marketConsensus-Bw6TFEKX.js";var r=(e,t=-1,n=1)=>Math.max(t,Math.min(n,e)),i=e=>r(e,0,1),a=e=>e>0?100/(e+100):Math.abs(e)/(Math.abs(e)+100),o=e=>{let t=Number(e);return Number.isFinite(t)?t:void 0};function s(e){return n(e)}function c(e){let t=e.trim().match(/(?:^|\s)([+-]?\d+(?:\.\d+)?)\s*$/);return t?Number(t[1]):void 0}function l(e,n){let r=s(n),i=t(e);if((r===`spread`||r===`total`||/player|prop|points|yards|rebounds|assists|goals|shots|strikeouts|hits|bases|sets|games/.test(r))&&(i=i.replace(/\s+[+-]?\d+(?:\.\d+)?\s*$/,``).trim()),r===`total`){if(/\bover\b/.test(i))return`over`;if(/\bunder\b/.test(i))return`under`}return i||t(e)}function u(e){let t=new Date(e);if(!Number.isFinite(t.getTime()))return e;let n=10*6e4;return new Date(Math.round(t.getTime()/n)*n).toISOString()}function d(e,n,r,i){return[t(e),t(n),t(r),u(i)].join(`|`)}function f(e,t,n,r,i,a){return[d(e,t,n,r),s(i),l(a,i)].join(`|`)}function p(e){if(e.length<2)return 0;let t=[];for(let n=1;n<e.length;n++)t.push(e[n].probability-e[n-1].probability);let n=t.reduce((e,t)=>e+t,0)/t.length,r=t.reduce((e,t)=>e+(t-n)**2,0)/t.length;return i(Math.sqrt(r)/.035)}function m(e,t,n=0){let a=[...e].filter(e=>Number.isFinite(e.odds)&&Number.isFinite(e.probability)).sort((e,t)=>new Date(e.pulledAt).getTime()-new Date(t.pulledAt).getTime());if(a.length<2)return null;let o=a[0],s=a[a.length-1],c=s.probability-o.probability,l=new Date(s.pulledAt).getTime()-60*6e4,u=a.filter(e=>new Date(e.pulledAt).getTime()>=l)[0]||o,d=s.probability-u.probability,f=d/Math.max(.25,(new Date(s.pulledAt).getTime()-new Date(u.pulledAt).getTime())/36e5),m=o.point,h=s.point,g=m!==void 0&&h!==void 0?h-m:0,_=a.map(e=>e.probability-o.probability),v=Math.max(..._),y=Math.min(..._),b=Math.abs(v)>=Math.abs(y)?v:y,x=b>=0?b-c:c-b,S=Math.abs(b)>=.012?Math.max(0,x)/Math.abs(b):0,C=S>=.35&&Math.abs(x)>=.008?r(-Math.sign(b)*Math.min(1,S)):0,w=r(d/.035),T=r(c/.06),E=t?.confidence??0,D=t?i((.45+.45*Math.max(-1,Math.min(1,t.closingSkill)))*(.35+.65*E)):.22,O=r(r(T*.38+w*.52+C*.28)*D),k=i((a.length-1)/5),A=i(Math.max(0,(new Date(s.pulledAt).getTime()-new Date(o.pulledAt).getTime())/36e5)/4),j=i(.15+k*.5+A*.2+E*.15),M=r(n/.04);return{marketOpenerOdds:o.odds,marketCurrentOdds:s.odds,marketOpenerProbability:o.probability,marketCurrentProbability:s.probability,marketProbabilityMove:c,marketRecentMove:d,marketPointMove:g,marketMoveVelocity:f,marketSteamSignal:w,marketReversalSignal:C,marketMovementVolatility:p(a),marketMovementConfidence:j,marketSnapshotCount:a.length,marketClosingLineSignal:O,marketClosingSkill:t?.closingSkill??0,marketClosingConfidence:E,marketClvBaseline:t?.avgClvProbability??0,marketSharpPublicGap:n,marketSharpSignal:M}}function h(e){let n=new Map;for(let r of e){if(!Number.isFinite(r.offeredOdds)||!Number.isFinite(r.closingOdds)||!Number.isFinite(r.outcome))continue;let e=[t(r.sport),s(r.marketKey)].join(`|`),i=n.get(e)||[];i.push(r),n.set(e,i)}let o=[];for(let[e,t]of n){let[n,s]=e.split(`|`),c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0;for(let e of t){let t=a(e.offeredOdds),n=a(e.closingOdds),r=n-t,i=Number(e.outcome);c+=r,m+=(t-i)**2,h+=(n-i)**2,r>=0?(l++,d++,u+=i):(p++,f+=i)}let g=t.length,_=m/g,v=h/g,y=r((_-v)/.04),b=i(g/(g+80)),x=i(1-Math.sqrt(v)/.7);o.push({sport:n,marketKey:s,sampleCount:g,avgClvProbability:c/g,positiveClvRate:l/g,positiveClvWinRate:d?u/d:0,negativeClvWinRate:p?f/p:0,offeredBrier:_,closingBrier:v,closingSkill:y,marketEfficiency:x,confidence:b})}return o.sort((e,t)=>t.sampleCount-e.sampleCount)}async function g(e){let n=await e`
  select sport,market_key as "marketKey",sample_count as "sampleCount",avg_clv_probability::float as "avgClvProbability",
   positive_clv_rate::float as "positiveClvRate",positive_clv_win_rate::float as "positiveClvWinRate",
   negative_clv_win_rate::float as "negativeClvWinRate",offered_brier::float as "offeredBrier",
   closing_brier::float as "closingBrier",closing_skill::float as "closingSkill",market_efficiency::float as "marketEfficiency",
   confidence::float as confidence
  from market_movement_profiles
 `,r=new Map;for(let e of n)r.set([t(e.sport),s(e.marketKey)].join(`|`),e);return r}async function _(n){let r=e();if(!r||!n.length)return{markets:n,matched:0,profiles:0,steam:0,reversals:0};let i=n.map(e=>new Date(e.startTime).getTime()).filter(Number.isFinite);if(!i.length)return{markets:n,matched:0,profiles:0,steam:0,reversals:0};let a=new Date(Math.min(...i)-12*36e5).toISOString(),o=new Date(Math.max(...i)+12*36e5).toISOString(),l=[...new Set(n.map(e=>e.sport))],[u,d]=await Promise.all([r`
   select e.sport,e.home_team_id as home,e.away_team_id as away,e.start_time as "startTime",
    ms.event_id as "eventId",ms.market_key as "marketKey",ms.selection_key as "selectionKey",
    ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as probability,
    ms.pulled_at as "pulledAt"
   from market_snapshots ms join events e on e.id=ms.event_id
   where e.start_time>=${a} and e.start_time<=${o}
    and e.sport in (select value from jsonb_array_elements_text(${r.json(l)}::jsonb))
    and ms.pulled_at<=least(e.start_time,now())
   order by ms.pulled_at asc
   limit 25000
  `,g(r)]),p=new Map;for(let e of u){let t=f(String(e.sport),String(e.home||``),String(e.away||``),new Date(e.startTime).toISOString(),String(e.marketKey),String(e.selectionKey)),n=p.get(t)||[];n.push({odds:Number(e.odds),probability:Number(e.probability),pulledAt:new Date(e.pulledAt).toISOString(),point:c(String(e.selectionKey))}),p.set(t,n)}let h=0,_=0,v=0,y=new Date().toISOString();return{markets:n.map(e=>{let n=p.get(f(e.sport,e.home,e.away,e.startTime,e.market,e.selection))||[];if(!n.length)return e;let r=m(n,d.get([t(e.sport),s(e.market)].join(`|`)),Number(e.consensus?.sharpPublicGap||0));if(!r)return e;h++,Math.abs(r.marketSteamSignal)>=.55&&_++,Math.abs(r.marketReversalSignal)>=.35&&v++;let i=[...e.contextProvenance||[],{source:`market-movement`,providerId:`edgeforce-v69-market-learning`,field:`marketClosingLineSignal`,observedAt:y,confidence:r.marketMovementConfidence,status:`LIVE`,detail:{openerOdds:r.marketOpenerOdds,currentOdds:r.marketCurrentOdds,openerProbability:r.marketOpenerProbability,currentProbability:r.marketCurrentProbability,probabilityMove:r.marketProbabilityMove,recentMove:r.marketRecentMove,pointMove:r.marketPointMove,snapshots:r.marketSnapshotCount,steam:r.marketSteamSignal,reversal:r.marketReversalSignal,closingSkill:r.marketClosingSkill}}];return{...e,sportFeatures:{...e.sportFeatures||{},...r},contextProvenance:i,contextSources:[...new Set([...e.contextSources||[],`market-movement`])]}}),matched:h,profiles:d.size,steam:_,reversals:v}}async function v(t){let n=e();if(!n)return 0;let r=new Date(Math.floor(Date.now()/36e5)*36e5).toISOString(),i=0,a=new Set;for(let e of t){let t=e.sportFeatures||{},c=o(t.marketMovementConfidence);if(c===void 0||c<=0)continue;let u=d(e.sport,e.home,e.away,e.startTime),f=s(e.market),p=l(e.selection,e.market),m=[u,f,p].join(`|`);a.has(m)||(a.add(m),await n`
   insert into market_movement_snapshots(
    sport,event_id,event_identity,market_key,selection_key,canonical_market,canonical_selection,start_time,
    opener_odds,current_odds,opener_probability,current_probability,probability_move,recent_probability_move,
    point_move,velocity_per_hour,steam_signal,reversal_signal,closing_line_signal,movement_confidence,
    sharp_public_gap,snapshot_count,observed_hour,metadata
   ) values(
    ${e.sport},${e.id},${u},${e.market},${e.selection},${f},${p},${e.startTime},
    ${Math.round(o(t.marketOpenerOdds)??e.odds)},${Math.round(o(t.marketCurrentOdds)??e.odds)},${o(t.marketOpenerProbability)??null},${o(t.marketCurrentProbability)??null},
    ${o(t.marketProbabilityMove)??0},${o(t.marketRecentMove)??0},${o(t.marketPointMove)??null},
    ${o(t.marketMoveVelocity)??0},${o(t.marketSteamSignal)??0},${o(t.marketReversalSignal)??0},
    ${o(t.marketClosingLineSignal)??0},${c},${o(t.marketSharpPublicGap)??null},
    ${Math.round(o(t.marketSnapshotCount)??0)},${r},
    ${n.json({closingSkill:o(t.marketClosingSkill)??0,closingConfidence:o(t.marketClosingConfidence)??0,clvBaseline:o(t.marketClvBaseline)??0})}
   )
   on conflict (event_identity,canonical_market,canonical_selection,observed_hour) do update set
    event_id=excluded.event_id,market_key=excluded.market_key,selection_key=excluded.selection_key,current_odds=excluded.current_odds,
    opener_probability=excluded.opener_probability,current_probability=excluded.current_probability,
    probability_move=excluded.probability_move,recent_probability_move=excluded.recent_probability_move,
    point_move=excluded.point_move,velocity_per_hour=excluded.velocity_per_hour,steam_signal=excluded.steam_signal,
    reversal_signal=excluded.reversal_signal,closing_line_signal=excluded.closing_line_signal,
    movement_confidence=excluded.movement_confidence,sharp_public_gap=excluded.sharp_public_gap,
    snapshot_count=excluded.snapshot_count,metadata=excluded.metadata
  `,i++)}return i}async function y(t,n,r){let i=e();if(!i)return null;let a=(await i`select sport,home_team_id as home,away_team_id as away,start_time as "startTime" from events where id=${t} limit 1`)[0];if(!a)return null;let o=await i`
  select ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as probability,
   ms.selection_key as "selectionKey",ms.market_key as "marketKey",ms.pulled_at as "pulledAt"
  from market_snapshots ms join events e on e.id=ms.event_id
  where lower(e.sport)=lower(${String(a.sport)}) and lower(coalesce(e.home_team_id,''))=lower(${String(a.home||``)})
   and lower(coalesce(e.away_team_id,''))=lower(${String(a.away||``)})
   and abs(extract(epoch from (e.start_time-${new Date(a.startTime).toISOString()}::timestamptz)))<=600
   and ms.pulled_at<=e.start_time
  order by ms.pulled_at desc limit 500
 `,c=s(n),u=l(r,n),d=o.find(e=>s(String(e.marketKey))===c&&l(String(e.selectionKey),String(e.marketKey))===u);return d?{odds:Number(d.odds),probability:Number(d.probability),pulledAt:new Date(d.pulledAt).toISOString()}:null}async function b(){let t=e();if(!t)return{configured:!1,settledRowsRead:0,profilesWritten:0};let n=await t`insert into market_movement_runs(model_version) values(${process.env.MODEL_VERSION||`edgeforce-v61`}) returning id`,r=Number(n[0]?.id||0),i=(await t`
  select sport,market_key as "marketKey",offered_odds as "offeredOdds",closing_odds as "closingOdds",outcome
  from historical_predictions
  where closing_odds is not null and offered_odds is not null and outcome is not null
   and occurred_at>=now()-interval '730 days'
  order by occurred_at desc limit 50000
 `).map(e=>({sport:String(e.sport),marketKey:String(e.marketKey),offeredOdds:Number(e.offeredOdds),closingOdds:Number(e.closingOdds),outcome:Number(e.outcome)})),a=h(i);for(let e of a)await t`
   insert into market_movement_profiles(
    sport,market_key,sample_count,avg_clv_probability,positive_clv_rate,positive_clv_win_rate,negative_clv_win_rate,
    offered_brier,closing_brier,closing_skill,market_efficiency,confidence,updated_at,metadata
   ) values(
    ${e.sport},${e.marketKey},${e.sampleCount},${e.avgClvProbability},${e.positiveClvRate},${e.positiveClvWinRate},${e.negativeClvWinRate},
    ${e.offeredBrier},${e.closingBrier},${e.closingSkill},${e.marketEfficiency},${e.confidence},now(),${t.json({lookbackDays:730})}
   )
   on conflict (sport,market_key) do update set
    sample_count=excluded.sample_count,avg_clv_probability=excluded.avg_clv_probability,positive_clv_rate=excluded.positive_clv_rate,
    positive_clv_win_rate=excluded.positive_clv_win_rate,negative_clv_win_rate=excluded.negative_clv_win_rate,
    offered_brier=excluded.offered_brier,closing_brier=excluded.closing_brier,closing_skill=excluded.closing_skill,
    market_efficiency=excluded.market_efficiency,confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `;return r&&await t`update market_movement_runs set settled_rows_read=${i.length},profiles_written=${a.length},completed_at=now(),metadata=${t.json({lookbackDays:730})} where id=${r}`,{configured:!0,settledRowsRead:i.length,profilesWritten:a.length}}async function x(){let t=e();if(!t)return{configured:!1,snapshots24h:0,profiles:0,steam24h:0,reversals24h:0,recent:[],profileRows:[]};let[n,r,i]=await Promise.all([t`
   select
    (select count(*)::int from market_movement_snapshots where observed_hour>now()-interval '24 hours') as "snapshots24h",
    (select count(*)::int from market_movement_profiles) as profiles,
    (select count(*)::int from market_movement_snapshots where observed_hour>now()-interval '24 hours' and abs(steam_signal)>=.55) as "steam24h",
    (select count(*)::int from market_movement_snapshots where observed_hour>now()-interval '24 hours' and abs(reversal_signal)>=.35) as "reversals24h"
  `,t`
   select sport,event_id as "eventId",market_key as "marketKey",selection_key as "selectionKey",start_time as "startTime",
    probability_move::float as "probabilityMove",recent_probability_move::float as "recentMove",point_move::float as "pointMove",
    steam_signal::float as "steamSignal",reversal_signal::float as "reversalSignal",
    closing_line_signal::float as "closingLineSignal",movement_confidence::float as confidence,snapshot_count as "snapshotCount"
   from market_movement_snapshots where observed_hour>now()-interval '24 hours'
   order by abs(closing_line_signal) desc,abs(recent_probability_move) desc limit 30
  `,t`
   select sport,market_key as "marketKey",sample_count as "sampleCount",avg_clv_probability::float as "avgClvProbability",
    closing_skill::float as "closingSkill",market_efficiency::float as "marketEfficiency",confidence::float as confidence
   from market_movement_profiles order by sample_count desc limit 30
  `]),a=n[0]||{};return{configured:!0,snapshots24h:Number(a.snapshots24h||0),profiles:Number(a.profiles||0),steam24h:Number(a.steam24h||0),reversals24h:Number(a.reversals24h||0),recent:r,profileRows:i}}export{_ as a,b as c,l as i,v as l,m as n,y as o,s as r,x as s,h as t};