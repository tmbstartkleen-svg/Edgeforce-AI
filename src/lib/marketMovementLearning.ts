import {db} from './db';
import type {Market,ContextProvenance} from './types';
import {canonicalConsensusMarket,normalizeConsensusText} from './marketConsensus';

type SnapshotRow={
 sport:string;home:string;away:string;startTime:string;eventId:string;
 marketKey:string;selectionKey:string;odds:number;probability:number;pulledAt:string;
};
export type MovementPoint={odds:number;probability:number;pulledAt:string;point?:number};
export type MarketMovementProfile={
 sport:string;marketKey:string;sampleCount:number;avgClvProbability:number;positiveClvRate:number;
 positiveClvWinRate:number;negativeClvWinRate:number;offeredBrier:number;closingBrier:number;
 closingSkill:number;marketEfficiency:number;confidence:number;
};
export type MarketMovementSignals={
 marketOpenerOdds:number;marketCurrentOdds:number;marketOpenerProbability:number;marketCurrentProbability:number;marketProbabilityMove:number;
 marketRecentMove:number;marketPointMove:number;marketMoveVelocity:number;marketSteamSignal:number;
 marketReversalSignal:number;marketMovementVolatility:number;marketMovementConfidence:number;
 marketSnapshotCount:number;marketClosingLineSignal:number;marketClosingSkill:number;
 marketClosingConfidence:number;marketClvBaseline:number;marketSharpPublicGap:number;marketSharpSignal:number;
};

const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const clamp01=(n:number)=>clamp(n,0,1);
const implied=(odds:number)=>odds>0?100/(odds+100):Math.abs(odds)/(Math.abs(odds)+100);
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:undefined};

export function canonicalMovementMarket(market:string){
 return canonicalConsensusMarket(market);
}

export function extractMarketPoint(selection:string){
 const normalized=selection.trim();
 const match=normalized.match(/(?:^|\s)([+-]?\d+(?:\.\d+)?)\s*$/);
 return match?Number(match[1]):undefined;
}

export function canonicalMovementSelection(selection:string,market:string){
 const canonical=canonicalMovementMarket(market);
 let value=normalizeConsensusText(selection);
 if(canonical==='spread'||canonical==='total'||/player|prop|points|yards|rebounds|assists|goals|shots|strikeouts|hits|bases|sets|games/.test(canonical)){
  value=value.replace(/\s+[+-]?\d+(?:\.\d+)?\s*$/,'').trim();
 }
 if(canonical==='total'){
  if(/\bover\b/.test(value))return 'over';
  if(/\bunder\b/.test(value))return 'under';
 }
 return value||normalizeConsensusText(selection);
}

function minuteKey(iso:string){
 const d=new Date(iso); if(!Number.isFinite(d.getTime()))return iso;
 d.setUTCSeconds(0,0);return d.toISOString();
}
export function movementEventIdentity(sport:string,home:string,away:string,startTime:string){
 return [normalizeConsensusText(sport),normalizeConsensusText(home),normalizeConsensusText(away),minuteKey(startTime)].join('|');
}
export function movementKey(sport:string,home:string,away:string,startTime:string,market:string,selection:string){
 return [movementEventIdentity(sport,home,away,startTime),canonicalMovementMarket(market),canonicalMovementSelection(selection,market)].join('|');
}

function movementVolatility(points:MovementPoint[]){
 if(points.length<2)return 0;
 const deltas:number[]=[];
 for(let i=1;i<points.length;i++)deltas.push(points[i].probability-points[i-1].probability);
 const mean=deltas.reduce((s,x)=>s+x,0)/deltas.length;
 const variance=deltas.reduce((s,x)=>s+(x-mean)**2,0)/deltas.length;
 return clamp01(Math.sqrt(variance)/.035);
}

export function buildMovementSignals(points:MovementPoint[],profile?:MarketMovementProfile,sharpPublicGap=0):MarketMovementSignals|null{
 const sorted=[...points].filter(x=>Number.isFinite(x.odds)&&Number.isFinite(x.probability)).sort((a,b)=>new Date(a.pulledAt).getTime()-new Date(b.pulledAt).getTime());
 if(!sorted.length)return null;
 const opener=sorted[0],current=sorted[sorted.length-1];
 const probabilityMove=current.probability-opener.probability;
 const cutoff=new Date(current.pulledAt).getTime()-60*60000;
 const recent=sorted.filter(x=>new Date(x.pulledAt).getTime()>=cutoff);
 const recentBase=recent[0]||opener;
 const recentMove=current.probability-recentBase.probability;
 const hours=Math.max(.25,(new Date(current.pulledAt).getTime()-new Date(recentBase.pulledAt).getTime())/3600000);
 const velocity=recentMove/hours;
 const openerPoint=opener.point,currentPoint=current.point;
 const pointMove=openerPoint!==undefined&&currentPoint!==undefined?currentPoint-openerPoint:0;

 const moves=sorted.map(x=>x.probability-opener.probability);
 const maxMove=Math.max(...moves),minMove=Math.min(...moves);
 const dominant=Math.abs(maxMove)>=Math.abs(minMove)?maxMove:minMove;
 const retrace=dominant>=0?dominant-probabilityMove:probabilityMove-dominant;
 const reversalRatio=Math.abs(dominant)>=.012?Math.max(0,retrace)/Math.abs(dominant):0;
 const reversalSignal=reversalRatio>=.35&&Math.abs(retrace)>=.008
  ?clamp(-Math.sign(dominant)*Math.min(1,reversalRatio))
  :0;

 const steamSignal=clamp(recentMove/.035);
 const longMoveSignal=clamp(probabilityMove/.06);
 const profileConfidence=profile?.confidence??0;
 const closingTrust=profile
  ?clamp01((.45+.45*Math.max(-1,Math.min(1,profile.closingSkill)))*(.35+.65*profileConfidence))
  :.22;
 const rawClosing=clamp(longMoveSignal*.38+steamSignal*.52+reversalSignal*.28);
 const closingLineSignal=clamp(rawClosing*closingTrust);
 const snapshotConfidence=clamp01((sorted.length-1)/5);
 const spanHours=Math.max(0,(new Date(current.pulledAt).getTime()-new Date(opener.pulledAt).getTime())/3600000);
 const spanConfidence=clamp01(spanHours/4);
 const movementConfidence=clamp01(.15+snapshotConfidence*.50+spanConfidence*.20+profileConfidence*.15);
 const sharpSignal=clamp(sharpPublicGap/.04);

 return {
  marketOpenerOdds:opener.odds,
  marketCurrentOdds:current.odds,
  marketOpenerProbability:opener.probability,
  marketCurrentProbability:current.probability,
  marketProbabilityMove:probabilityMove,
  marketRecentMove:recentMove,
  marketPointMove:pointMove,
  marketMoveVelocity:velocity,
  marketSteamSignal:steamSignal,
  marketReversalSignal:reversalSignal,
  marketMovementVolatility:movementVolatility(sorted),
  marketMovementConfidence:movementConfidence,
  marketSnapshotCount:sorted.length,
  marketClosingLineSignal:closingLineSignal,
  marketClosingSkill:profile?.closingSkill??0,
  marketClosingConfidence:profileConfidence,
  marketClvBaseline:profile?.avgClvProbability??0,
  marketSharpPublicGap:sharpPublicGap,
  marketSharpSignal:sharpSignal
 };
}

export function buildMarketMovementProfile(rows:Array<{sport:string;marketKey:string;offeredOdds:number;closingOdds:number;outcome:number}>):MarketMovementProfile[]{
 const groups=new Map<string,typeof rows>();
 for(const row of rows){
  if(!Number.isFinite(row.offeredOdds)||!Number.isFinite(row.closingOdds)||!Number.isFinite(row.outcome))continue;
  const sport=normalizeConsensusText(row.sport);
  const marketKey=canonicalMovementMarket(row.marketKey);
  const key=[sport,marketKey].join('|');
  const list=groups.get(key)||[];list.push(row);groups.set(key,list);
 }
 const out:MarketMovementProfile[]=[];
 for(const [key,list] of groups){
  const [sport,marketKey]=key.split('|');
  let clv=0,positive=0,posWins=0,posN=0,negWins=0,negN=0,offeredBrier=0,closingBrier=0;
  for(const row of list){
   const offered=implied(row.offeredOdds),close=implied(row.closingOdds),edge=close-offered,outcome=Number(row.outcome);
   clv+=edge;offeredBrier+=(offered-outcome)**2;closingBrier+=(close-outcome)**2;
   if(edge>=0){positive++;posN++;posWins+=outcome}else{negN++;negWins+=outcome}
  }
  const n=list.length,offB=offeredBrier/n,closeB=closingBrier/n;
  const closingSkill=clamp((offB-closeB)/.04);
  const confidence=clamp01(n/(n+80));
  const efficiency=clamp01(1-Math.sqrt(closeB)/.70);
  out.push({
   sport,marketKey,sampleCount:n,avgClvProbability:clv/n,positiveClvRate:positive/n,
   positiveClvWinRate:posN?posWins/posN:0,negativeClvWinRate:negN?negWins/negN:0,
   offeredBrier:offB,closingBrier:closeB,closingSkill,marketEfficiency:efficiency,confidence
  });
 }
 return out.sort((a,b)=>b.sampleCount-a.sampleCount);
}

async function loadProfiles(sql:NonNullable<ReturnType<typeof db>>){
 const rows=await sql`
  select sport,market_key as "marketKey",sample_count as "sampleCount",avg_clv_probability::float as "avgClvProbability",
   positive_clv_rate::float as "positiveClvRate",positive_clv_win_rate::float as "positiveClvWinRate",
   negative_clv_win_rate::float as "negativeClvWinRate",offered_brier::float as "offeredBrier",
   closing_brier::float as "closingBrier",closing_skill::float as "closingSkill",market_efficiency::float as "marketEfficiency",
   confidence::float as confidence
  from market_movement_profiles
 `;
 const map=new Map<string,MarketMovementProfile>();
 for(const row of rows as any[])map.set([normalizeConsensusText(row.sport),canonicalMovementMarket(row.marketKey)].join('|'),row as MarketMovementProfile);
 return map;
}

export async function enrichMarketsWithMarketMovement(markets:Market[]){
 const sql=db();
 if(!sql||!markets.length)return {markets,matched:0,profiles:0,steam:0,reversals:0};
 const starts=markets.map(x=>new Date(x.startTime).getTime()).filter(Number.isFinite);
 if(!starts.length)return {markets,matched:0,profiles:0,steam:0,reversals:0};
 const from=new Date(Math.min(...starts)-12*3600000).toISOString();
 const to=new Date(Math.max(...starts)+12*3600000).toISOString();
 const sports=[...new Set(markets.map(x=>x.sport))];
 const [rows,profiles]=await Promise.all([
  sql`
   select e.sport,e.home_team_id as home,e.away_team_id as away,e.start_time as "startTime",
    ms.event_id as "eventId",ms.market_key as "marketKey",ms.selection_key as "selectionKey",
    ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as probability,
    ms.pulled_at as "pulledAt"
   from market_snapshots ms join events e on e.id=ms.event_id
   where e.start_time>=${from} and e.start_time<=${to}
    and e.sport in (select value from jsonb_array_elements_text(${sql.json(sports)}::jsonb))
    and ms.pulled_at<=least(e.start_time,now())
   order by ms.pulled_at asc
   limit 25000
  `,
  loadProfiles(sql)
 ]);
 const groups=new Map<string,MovementPoint[]>();
 for(const row of rows as any[]){
  const k=movementKey(String(row.sport),String(row.home||''),String(row.away||''),new Date(row.startTime).toISOString(),String(row.marketKey),String(row.selectionKey));
  const list=groups.get(k)||[];
  list.push({odds:Number(row.odds),probability:Number(row.probability),pulledAt:new Date(row.pulledAt).toISOString(),point:extractMarketPoint(String(row.selectionKey))});
  groups.set(k,list);
 }
 let matched=0,steam=0,reversals=0;
 const now=new Date().toISOString();
 const enriched=markets.map(m=>{
  const points=groups.get(movementKey(m.sport,m.home,m.away,m.startTime,m.market,m.selection))||[];
  if(!points.length)return m;
  const profile=profiles.get([normalizeConsensusText(m.sport),canonicalMovementMarket(m.market)].join('|'));
  const sharpPublicGap=Number(m.consensus?.sharpPublicGap||0);
  const signals=buildMovementSignals(points,profile,sharpPublicGap);
  if(!signals)return m;
  matched++;if(Math.abs(signals.marketSteamSignal)>=.55)steam++;if(Math.abs(signals.marketReversalSignal)>=.35)reversals++;
  const provenance:ContextProvenance[]=[...(m.contextProvenance||[]),{
   source:'market-movement',providerId:'edgeforce-v69-market-learning',field:'marketClosingLineSignal',
   observedAt:now,confidence:signals.marketMovementConfidence,status:'LIVE',
   detail:{
    openerOdds:signals.marketOpenerOdds,currentOdds:signals.marketCurrentOdds,openerProbability:signals.marketOpenerProbability,currentProbability:signals.marketCurrentProbability,
    probabilityMove:signals.marketProbabilityMove,recentMove:signals.marketRecentMove,pointMove:signals.marketPointMove,
    snapshots:signals.marketSnapshotCount,steam:signals.marketSteamSignal,reversal:signals.marketReversalSignal,
    closingSkill:signals.marketClosingSkill
   }
  }];
  return {...m,sportFeatures:{...(m.sportFeatures||{}),...signals},contextProvenance:provenance,contextSources:[...new Set([...(m.contextSources||[]),'market-movement'])]};
 });
 return {markets:enriched,matched,profiles:profiles.size,steam,reversals};
}

export async function recordMarketMovementSnapshots(markets:Market[]){
 const sql=db();if(!sql)return 0;
 const observedHour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 let written=0;const seen=new Set<string>();
 for(const m of markets){
  const f=m.sportFeatures||{};const confidence=finite(f.marketMovementConfidence);
  if(confidence===undefined||confidence<=0)continue;
  const identity=movementEventIdentity(m.sport,m.home,m.away,m.startTime);
  const canonicalMarket=canonicalMovementMarket(m.market),canonicalSelection=canonicalMovementSelection(m.selection,m.market);
  const unique=[identity,canonicalMarket,canonicalSelection].join('|');if(seen.has(unique))continue;seen.add(unique);
  await sql`
   insert into market_movement_snapshots(
    sport,event_id,event_identity,market_key,selection_key,canonical_market,canonical_selection,start_time,
    opener_odds,current_odds,opener_probability,current_probability,probability_move,recent_probability_move,
    point_move,velocity_per_hour,steam_signal,reversal_signal,closing_line_signal,movement_confidence,
    sharp_public_gap,snapshot_count,observed_hour,metadata
   ) values(
    ${m.sport},${m.id},${identity},${m.market},${m.selection},${canonicalMarket},${canonicalSelection},${m.startTime},
    ${Math.round(finite(f.marketOpenerOdds)??m.odds)},${Math.round(finite(f.marketCurrentOdds)??m.odds)},${finite(f.marketOpenerProbability)??null},${finite(f.marketCurrentProbability)??null},
    ${finite(f.marketProbabilityMove)??0},${finite(f.marketRecentMove)??0},${finite(f.marketPointMove)??null},
    ${finite(f.marketMoveVelocity)??0},${finite(f.marketSteamSignal)??0},${finite(f.marketReversalSignal)??0},
    ${finite(f.marketClosingLineSignal)??0},${confidence},${finite(f.marketSharpPublicGap)??null},
    ${Math.round(finite(f.marketSnapshotCount)??0)},${observedHour},
    ${sql.json({closingSkill:finite(f.marketClosingSkill)??0,closingConfidence:finite(f.marketClosingConfidence)??0,clvBaseline:finite(f.marketClvBaseline)??0})}
   )
   on conflict (event_identity,canonical_market,canonical_selection,observed_hour) do update set
    event_id=excluded.event_id,market_key=excluded.market_key,selection_key=excluded.selection_key,current_odds=excluded.current_odds,
    opener_probability=excluded.opener_probability,current_probability=excluded.current_probability,
    probability_move=excluded.probability_move,recent_probability_move=excluded.recent_probability_move,
    point_move=excluded.point_move,velocity_per_hour=excluded.velocity_per_hour,steam_signal=excluded.steam_signal,
    reversal_signal=excluded.reversal_signal,closing_line_signal=excluded.closing_line_signal,
    movement_confidence=excluded.movement_confidence,sharp_public_gap=excluded.sharp_public_gap,
    snapshot_count=excluded.snapshot_count,metadata=excluded.metadata
  `;
  written++;
 }
 return written;
}

export async function inferCanonicalClosingLine(eventId:string,marketKey:string,selectionKey:string){
 const sql=db();if(!sql)return null;
 const eventRows=await sql`select sport,home_team_id as home,away_team_id as away,start_time as "startTime" from events where id=${eventId} limit 1`;
 const event=(eventRows as any[])[0];if(!event)return null;
 const rows=await sql`
  select ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as probability,
   ms.selection_key as "selectionKey",ms.market_key as "marketKey",ms.pulled_at as "pulledAt"
  from market_snapshots ms join events e on e.id=ms.event_id
  where lower(e.sport)=lower(${String(event.sport)}) and lower(coalesce(e.home_team_id,''))=lower(${String(event.home||'')})
   and lower(coalesce(e.away_team_id,''))=lower(${String(event.away||'')})
   and abs(extract(epoch from (e.start_time-${new Date(event.startTime).toISOString()}::timestamptz)))<=600
   and ms.pulled_at<=e.start_time
  order by ms.pulled_at desc limit 500
 `;
 const cm=canonicalMovementMarket(marketKey),cs=canonicalMovementSelection(selectionKey,marketKey);
 const match=(rows as any[]).find(row=>canonicalMovementMarket(String(row.marketKey))===cm&&canonicalMovementSelection(String(row.selectionKey),String(row.marketKey))===cs);
 return match?{odds:Number(match.odds),probability:Number(match.probability),pulledAt:new Date(match.pulledAt).toISOString()}:null;
}

export async function rebuildMarketMovementProfiles(){
 const sql=db();if(!sql)return {configured:false,settledRowsRead:0,profilesWritten:0};
 const run=await sql`insert into market_movement_runs(model_version) values(${process.env.MODEL_VERSION||'edgeforce-v61'}) returning id`;
 const runId=Number((run as any[])[0]?.id||0);
 const rows=await sql`
  select sport,market_key as "marketKey",offered_odds as "offeredOdds",closing_odds as "closingOdds",outcome
  from historical_predictions
  where closing_odds is not null and offered_odds is not null and outcome is not null
   and occurred_at>=now()-interval '730 days'
  order by occurred_at desc limit 50000
 `;
 const normalized=(rows as any[]).map(r=>({sport:String(r.sport),marketKey:String(r.marketKey),offeredOdds:Number(r.offeredOdds),closingOdds:Number(r.closingOdds),outcome:Number(r.outcome)}));
 const profiles=buildMarketMovementProfile(normalized);
 for(const p of profiles){
  await sql`
   insert into market_movement_profiles(
    sport,market_key,sample_count,avg_clv_probability,positive_clv_rate,positive_clv_win_rate,negative_clv_win_rate,
    offered_brier,closing_brier,closing_skill,market_efficiency,confidence,updated_at,metadata
   ) values(
    ${p.sport},${p.marketKey},${p.sampleCount},${p.avgClvProbability},${p.positiveClvRate},${p.positiveClvWinRate},${p.negativeClvWinRate},
    ${p.offeredBrier},${p.closingBrier},${p.closingSkill},${p.marketEfficiency},${p.confidence},now(),${sql.json({lookbackDays:730})}
   )
   on conflict (sport,market_key) do update set
    sample_count=excluded.sample_count,avg_clv_probability=excluded.avg_clv_probability,positive_clv_rate=excluded.positive_clv_rate,
    positive_clv_win_rate=excluded.positive_clv_win_rate,negative_clv_win_rate=excluded.negative_clv_win_rate,
    offered_brier=excluded.offered_brier,closing_brier=excluded.closing_brier,closing_skill=excluded.closing_skill,
    market_efficiency=excluded.market_efficiency,confidence=excluded.confidence,updated_at=now(),metadata=excluded.metadata
  `;
 }
 if(runId)await sql`update market_movement_runs set settled_rows_read=${normalized.length},profiles_written=${profiles.length},completed_at=now(),metadata=${sql.json({lookbackDays:730})} where id=${runId}`;
 return {configured:true,settledRowsRead:normalized.length,profilesWritten:profiles.length};
}

export async function loadMarketMovementLearningSummary(){
 const sql=db();if(!sql)return {configured:false,snapshots24h:0,profiles:0,steam24h:0,reversals24h:0,recent:[],profileRows:[]};
 const [counts,recent,profileRows]=await Promise.all([
  sql`
   select
    (select count(*)::int from market_movement_snapshots where observed_hour>now()-interval '24 hours') as "snapshots24h",
    (select count(*)::int from market_movement_profiles) as profiles,
    (select count(*)::int from market_movement_snapshots where observed_hour>now()-interval '24 hours' and abs(steam_signal)>=.55) as "steam24h",
    (select count(*)::int from market_movement_snapshots where observed_hour>now()-interval '24 hours' and abs(reversal_signal)>=.35) as "reversals24h"
  `,
  sql`
   select sport,event_id as "eventId",market_key as "marketKey",selection_key as "selectionKey",start_time as "startTime",
    probability_move::float as "probabilityMove",recent_probability_move::float as "recentMove",point_move::float as "pointMove",
    steam_signal::float as "steamSignal",reversal_signal::float as "reversalSignal",
    closing_line_signal::float as "closingLineSignal",movement_confidence::float as confidence,snapshot_count as "snapshotCount"
   from market_movement_snapshots where observed_hour>now()-interval '24 hours'
   order by abs(closing_line_signal) desc,abs(recent_probability_move) desc limit 30
  `,
  sql`
   select sport,market_key as "marketKey",sample_count as "sampleCount",avg_clv_probability::float as "avgClvProbability",
    closing_skill::float as "closingSkill",market_efficiency::float as "marketEfficiency",confidence::float as confidence
   from market_movement_profiles order by sample_count desc limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,snapshots24h:Number(c.snapshots24h||0),profiles:Number(c.profiles||0),steam24h:Number(c.steam24h||0),reversals24h:Number(c.reversals24h||0),recent,profileRows};
}
