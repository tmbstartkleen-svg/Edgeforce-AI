import{t as e}from"./db-9LtqYd6N.js";var t=e=>e.trim().toLowerCase().replace(/\s+/g,` `);function n(e,n=``){let r=t(`${e} ${n}`),i=r.includes(` over `)||r.startsWith(`over `)?`over`:r.includes(` under `)||r.startsWith(`under `)?`under`:r.includes(`moneyline`)||r.includes(` moneyline`)?`moneyline`:r.includes(`spread`)||r.includes(`run line`)||r.includes(`puck line`)?`spread`:r.includes(`total`)?`total`:`neutral`;return`${t(e)}|${i}`}var r=(e,n,r)=>{let[i,a]=[t(n),t(r)].sort();return[t(e),i,a].join(`|`)},i=(e,t=-.75,n=.75)=>Math.max(t,Math.min(n,e));async function a(){let t=e();if(!t)return{};try{let e=await t`
   select sport,market_a as "marketA",market_b as "marketB",sample_size as "sampleSize",
    joint_hits as "jointHits",a_hits as "aHits",b_hits as "bHits",
    phi::float,lift::float,learned_rho::float as "learnedRho",confidence::float
   from sgp_correlation_profiles
   where abs(learned_rho)>0.000001
   order by sample_size desc,confidence desc
  `,n={};for(let t of e){let e={sport:String(t.sport),marketA:String(t.marketA),marketB:String(t.marketB),sampleSize:Number(t.sampleSize||0),jointHits:Number(t.jointHits||0),aHits:Number(t.aHits||0),bHits:Number(t.bHits||0),phi:Number(t.phi||0),lift:Number(t.lift||0),learnedRho:Number(t.learnedRho||0),confidence:Number(t.confidence||0)};n[r(e.sport,e.marketA,e.marketB)]=e}return n}catch{return{}}}async function o(){let t=e(),a=Math.max(10,Number(process.env.SGP_CORRELATION_MIN_SAMPLE||20)),o=Math.max(10,Number(process.env.SGP_CORRELATION_SHRINKAGE_SAMPLES||50));if(!t)return{ok:!0,mode:`dry-run`,pairRows:0,profilesWritten:0,activeProfiles:0,minimumSample:a,shrinkageSamples:o};let s=await t`
  select coalesce(a.sport,b.sport,'Unknown') as sport,
   a.market_type as "marketA",b.market_type as "marketB",
   a.selection as "selectionA",b.selection as "selectionB",
   a.result as "aResult",b.result as "bResult"
  from bet_legs a
  join bet_legs b
   on a.bet_slip_id=b.bet_slip_id
   and a.event_id=b.event_id
   and a.ordinal<b.ordinal
  where a.event_id is not null
   and a.result in ('win','loss')
   and b.result in ('win','loss')
  order by coalesce(a.settled_at,b.settled_at) desc nulls last
  limit 20000
 `,c=new Map;for(let e of s){let t=n(String(e.marketA||`Unknown`),String(e.selectionA||``)),i=n(String(e.marketB||`Unknown`),String(e.selectionB||``)),a=e.aResult===`win`,o=e.bResult===`win`;t>i&&([t,i]=[i,t],[a,o]=[o,a]);let s=r(String(e.sport||`Unknown`),t,i),l=c.get(s)||{sport:String(e.sport||`Unknown`),marketA:t,marketB:i,n11:0,n10:0,n01:0,n00:0};a&&o?l.n11++:a&&!o?l.n10++:!a&&o?l.n01++:l.n00++,c.set(s,l)}let l=process.env.MODEL_VERSION||`edgeforce-v35`,[u]=await t`
  insert into sgp_correlation_runs(model_version,pair_rows,minimum_sample,shrinkage_samples)
  values(${l},${s.length},${a},${o})
  returning id
 `,d=0,f=0;for(let e of c.values()){let n=e.n11+e.n10+e.n01+e.n00,r=e.n11+e.n10,s=e.n11+e.n01,c=Math.sqrt((e.n11+e.n10)*(e.n01+e.n00)*(e.n11+e.n01)*(e.n10+e.n00)),u=c>0?(e.n11*e.n00-e.n10*e.n01)/c:0,p=n?r/n:0,m=n?s/n:0,h=n?e.n11/n:0,g=p>0&&m>0?h/(p*m)-1:0,_=n/(n+o),v=n>=a?i(u*_,-.55,.55):0;n>=a&&f++,await t`
   insert into sgp_correlation_profiles(
    sport,market_a,market_b,sample_size,joint_hits,a_hits,b_hits,phi,lift,
    learned_rho,confidence,minimum_sample,model_version,updated_at
   ) values(
    ${e.sport},${e.marketA},${e.marketB},${n},${e.n11},${r},${s},
    ${u},${g},${v},${_},${a},${l},now()
   )
   on conflict (sport,market_a,market_b) do update set
    sample_size=excluded.sample_size,joint_hits=excluded.joint_hits,a_hits=excluded.a_hits,b_hits=excluded.b_hits,
    phi=excluded.phi,lift=excluded.lift,learned_rho=excluded.learned_rho,confidence=excluded.confidence,
    minimum_sample=excluded.minimum_sample,model_version=excluded.model_version,updated_at=now()
  `,d++}return await t`
  update sgp_correlation_runs
  set profiles_written=${d},active_profiles=${f},completed_at=now()
  where id=${u.id}
 `,{ok:!0,mode:`database`,runId:Number(u.id),pairRows:s.length,profilesWritten:d,activeProfiles:f,minimumSample:a,shrinkageSamples:o}}export{o as n,a as t};