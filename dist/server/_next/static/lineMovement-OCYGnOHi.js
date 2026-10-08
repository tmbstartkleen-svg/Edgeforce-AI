import{t as e}from"./db-9LtqYd6N.js";var t=(e,t,n)=>[e,t,n].join(`|`);function n(e){if(e.length<2)return{direction:`FLAT`,deltaOdds:0,velocityPerHour:0};let t=[...e].sort((e,t)=>new Date(e.pulledAt).getTime()-new Date(t.pulledAt).getTime()),n=t[0],r=t[t.length-1],i=r.odds-n.odds,a=Math.max(.01,(new Date(r.pulledAt).getTime()-new Date(n.pulledAt).getTime())/36e5);return{direction:i>3?`UP`:i<-3?`DOWN`:`FLAT`,deltaOdds:i,velocityPerHour:i/a}}async function r(n){let r=e();if(!r||!n.length)return new Map;let i=[...new Set(n.map(e=>e.id))],a=await r`
  select ms.event_id as "eventId",ms.market_key as "marketKey",ms.selection_key as "selectionKey",
   ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as probability,ms.pulled_at as "pulledAt"
  from market_snapshots ms
  where ms.event_id in (select value from jsonb_array_elements_text(${r.json(i)}::jsonb))
  order by ms.event_id,ms.market_key,ms.selection_key,ms.pulled_at asc
 `,o=new Map;for(let e of a){let n=t(String(e.eventId),String(e.marketKey),String(e.selectionKey)),r=o.get(n)||[];r.push({eventId:String(e.eventId),marketKey:String(e.marketKey),selectionKey:String(e.selectionKey),odds:Number(e.odds),probability:Number(e.probability),pulledAt:new Date(e.pulledAt).toISOString()}),o.set(n,r)}let s=new Map;for(let e of n){let n=o.get(t(e.id,e.market,e.selection))||[];if(!n.length)continue;let r=n[0],i=n[n.length-1],a=i.probability-r.probability,c=new Date(i.pulledAt).getTime()-30*6e4,l=n.filter(e=>new Date(e.pulledAt).getTime()>=c),u=i.probability-(l[0]?.probability??r.probability),d=Math.abs(u)>=.02&&l.length>=2,f=Math.abs(u)>=.035&&l.length>=3?`STRONG`:d?`WATCH`:`NONE`;s.set(e.id,{marketId:e.id,market:e.market,selection:e.selection,openerOdds:r.odds,currentOdds:i.odds,openerProbability:r.probability,currentProbability:i.probability,probabilityMove:a,oddsMove:i.odds-r.odds,snapshotCount:n.length,firstSeenAt:r.pulledAt,lastSeenAt:i.pulledAt,moveWindowMin:Math.max(.01,(new Date(i.pulledAt).getTime()-new Date(r.pulledAt).getTime())/6e4),direction:Math.abs(a)<.002?`FLAT`:a>0?`TOWARD`:`AWAY`,steam:d,steamStrength:f})}return s}async function i(t=100){let n=e();return n?(await n`
  select ms.event_id as "eventId",ms.market_key as market,ms.selection_key as selection,min(ms.pulled_at) as "firstSeenAt",max(ms.pulled_at) as "lastSeenAt",count(*)::int as "snapshotCount",
   (array_agg(ms.american_odds order by ms.pulled_at asc))[1] as "openerOdds",(array_agg(ms.american_odds order by ms.pulled_at desc))[1] as "currentOdds",
   (array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at asc))[1]::float as "openerProbability",
   (array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at desc))[1]::float as "currentProbability"
  from market_snapshots ms join events e on e.id=ms.event_id
  where e.start_time>now() and e.start_time<=now()+interval '8 days' and ms.pulled_at>=now()-interval '24 hours'
  group by ms.event_id,ms.market_key,ms.selection_key having count(*)>=2
  order by abs((array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at desc))[1]-(array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at asc))[1]) desc limit ${t}
 `).map(e=>{let t=Number(e.currentProbability)-Number(e.openerProbability);return{...e,probabilityMove:t,oddsMove:Number(e.currentOdds)-Number(e.openerOdds),direction:Math.abs(t)<.002?`FLAT`:t>0?`TOWARD`:`AWAY`,steam:Math.abs(t)>=.02,steamStrength:Math.abs(t)>=.035&&Number(e.snapshotCount)>=3?`STRONG`:Math.abs(t)>=.02?`WATCH`:`NONE`}}):[]}async function a(t){let n=e();if(!n)return 0;let r=await n`
  update bet_legs bl set
   closing_odds=close_line.odds,
   closing_implied_probability=case when close_line.odds>0 then 100.0/(close_line.odds+100.0) else abs(close_line.odds)::float/(abs(close_line.odds)+100.0) end,
   clv_probability=(
    case when close_line.odds>0 then 100.0/(close_line.odds+100.0) else abs(close_line.odds)::float/(abs(close_line.odds)+100.0) end
   )-coalesce(
    bl.raw_implied_probability,
    case when bl.offered_odds>0 then 100.0/(bl.offered_odds+100.0) else abs(bl.offered_odds)::float/(abs(bl.offered_odds)+100.0) end
   )
  from lateral (select ms.american_odds as odds from market_snapshots ms join events e on e.id=ms.event_id where ms.event_id=bl.event_id and lower(ms.market_key)=lower(bl.market_type) and lower(ms.selection_key)=lower(bl.selection) and ms.pulled_at<=e.start_time order by ms.pulled_at desc limit 1) close_line
  where bl.bet_slip_id=${t} and bl.closing_odds is null and bl.event_id is not null returning bl.ordinal
 `;return await n`
  update bet_legs set
   closing_implied_probability=case when closing_odds>0 then 100.0/(closing_odds+100.0) else abs(closing_odds)::float/(abs(closing_odds)+100.0) end,
   clv_probability=(case when closing_odds>0 then 100.0/(closing_odds+100.0) else abs(closing_odds)::float/(abs(closing_odds)+100.0) end)-coalesce(raw_implied_probability,case when offered_odds>0 then 100.0/(offered_odds+100.0) else abs(offered_odds)::float/(abs(offered_odds)+100.0) end)
  where bet_slip_id=${t} and closing_odds is not null and offered_odds is not null
 `,r.length}export{n as i,r as n,i as r,a as t};