import {db} from './db';
import {clvFromOdds} from './clv';
import {americanToDecimal} from './settlement';
import type {CompletedEventResult,PlayerStatResult} from './providers/results';

type PendingRun={
  modelRunId:number;
  eventId:string;
  marketKey:string;
  selectionKey:string;
  modelVersion:string;
  modelProbability:number;
  simulationProbability:number|null;
  simulationMode:string|null;
  createdAt:string;
  featureSnapshot:Record<string,unknown>;
  sport:string;
  home:string;
  away:string;
  startTime:string;
};

const norm=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const numberValue=(v:unknown)=>{
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v)))return Number(v);
  return null;
};
const aliases:Record<string,string[]>={
  passing_yards:['passing_yards','pass_yards','passingYards','PassYds','PY'],
  passing_tds:['passing_tds','pass_tds','passingTouchdowns','PassTD'],
  rushing_yards:['rushing_yards','rush_yards','rushingYards','RushYds'],
  receiving_yards:['receiving_yards','rec_yards','receivingYards','RecYds'],
  receptions:['receptions','recs','Rec'],
  points:['points','pts','Points'],
  rebounds:['rebounds','reb','Rebounds'],
  assists:['assists','ast','Assists'],
  threes:['three_pointers_made','threes','3pm','ThreePointersMade'],
  strikeouts:['strikeouts','so','Strikeouts'],
  hits:['hits','h','Hits'],
  total_bases:['total_bases','tb','TotalBases'],
  saves:['saves','sv','Saves'],
  shots_on_goal:['shots_on_goal','sog','ShotsOnGoal'],
  aces:['aces','Aces'],
  double_faults:['double_faults','DoubleFaults']
};

function sameTeam(a:string,b:string){
  const x=norm(a),y=norm(b);
  return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));
}
function samePlayer(a:string,b:string){
  const x=norm(a),y=norm(b);
  return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));
}
function findResult(run:PendingRun,results:CompletedEventResult[]){
  const exact=results.find(r=>r.providerEventId===run.eventId);
  if(exact)return exact;
  const start=new Date(run.startTime).getTime();
  return results.find(r=>{
    if(!sameTeam(r.home,run.home)||!sameTeam(r.away,run.away))return false;
    if(!r.commenceTime)return true;
    const t=new Date(r.commenceTime).getTime();
    return Number.isFinite(t)&&Math.abs(t-start)<=36*3600000;
  });
}
function playerName(run:PendingRun){
  return String(run.featureSnapshot.player||'').trim();
}
function findPlayerResult(run:PendingRun,results:PlayerStatResult[]){
  const player=playerName(run);
  if(!player)return null;
  const exact=results.find(r=>r.providerEventId&&r.providerEventId===run.eventId&&samePlayer(r.player,player));
  if(exact)return exact;
  const start=new Date(run.startTime).getTime();
  return results.find(r=>{
    if(!samePlayer(r.player,player))return false;
    if(!r.commenceTime)return true;
    const t=new Date(r.commenceTime).getTime();
    return Number.isFinite(t)&&Math.abs(t-start)<=36*3600000;
  })||null;
}
function canonicalMarket(run:PendingRun){
  const market=String(run.featureSnapshot.market||run.marketKey||'').toLowerCase();
  if(market.includes('moneyline')||market==='h2h'||market==='ml')return 'Moneyline';
  if(market.includes('spread')||market.includes('run_line')||market.includes('puck_line'))return 'Spread';
  if(market.includes('total')&&!market.includes('player'))return 'Total';
  if(market.includes('player')||run.featureSnapshot.player)return 'Player Prop';
  return String(run.featureSnapshot.market||run.marketKey||'');
}
function selectionSide(run:PendingRun){
  const s=norm(run.selectionKey);
  if(norm(run.home)&&s.includes(norm(run.home)))return 'home';
  if(norm(run.away)&&s.includes(norm(run.away)))return 'away';
  if(s.includes('draw'))return 'draw';
  return '';
}
function pointFrom(run:PendingRun){
  const direct=numberValue(run.featureSnapshot.point);
  if(direct!==null)return direct;
  const matches=run.selectionKey.match(/([+-]?\d+(?:\.\d+)?)\s*$/);
  return matches?Number(matches[1]):null;
}
function propType(run:PendingRun){
  const s=norm(String(run.featureSnapshot.prop||'')+' '+run.marketKey+' '+run.selectionKey);
  if(s.includes('passing yard'))return 'passing_yards';
  if(s.includes('passing td')||s.includes('pass touchdown'))return 'passing_tds';
  if(s.includes('rushing yard'))return 'rushing_yards';
  if(s.includes('receiving yard'))return 'receiving_yards';
  if(s.includes('reception'))return 'receptions';
  if(s.includes('rebound'))return 'rebounds';
  if(s.includes('assist'))return 'assists';
  if(s.includes('three')||s.includes('3 pointer'))return 'threes';
  if(s.includes('strikeout'))return 'strikeouts';
  if(s.includes('total base'))return 'total_bases';
  if(s.includes('save'))return 'saves';
  if(s.includes('shot on goal'))return 'shots_on_goal';
  if(s.includes('double fault'))return 'double_faults';
  if(s.includes('ace'))return 'aces';
  if(s.includes('point'))return 'points';
  if(s.includes(' hit'))return 'hits';
  return '';
}
function statValue(stats:Record<string,number>,type:string){
  for(const key of aliases[type]||[type]){
    const value=stats[key];
    if(typeof value==='number'&&Number.isFinite(value))return value;
  }
  return null;
}
function isOver(run:PendingRun){
  const s=norm(run.selectionKey);
  return s.startsWith('over')||s.includes(' over ');
}
function isUnder(run:PendingRun){
  const s=norm(run.selectionKey);
  return s.startsWith('under')||s.includes(' under ');
}
function gradePlayerProp(run:PendingRun,result:PlayerStatResult){
  const type=propType(run),point=pointFrom(run);
  if(!type||point===null)return null;
  const actual=statValue(result.stats,type);
  if(actual===null)return null;
  if(Math.abs(actual-point)<1e-9)return {grade:'push' as const,type,actual};
  if(isOver(run))return {grade:(actual>point?'win':'loss') as 'win'|'loss',type,actual};
  if(isUnder(run))return {grade:(actual<point?'win':'loss') as 'win'|'loss',type,actual};
  return null;
}
function gradeGame(run:PendingRun,result:CompletedEventResult):'win'|'loss'|'push'|null{
  const market=canonicalMarket(run);
  const h=result.homeScore,a=result.awayScore;
  if(market==='Moneyline'){
    const side=selectionSide(run);
    if(side==='draw')return h===a?'win':'loss';
    if(h===a)return 'push';
    if(side==='home')return h>a?'win':'loss';
    if(side==='away')return a>h?'win':'loss';
    return null;
  }
  if(market==='Spread'){
    const point=pointFrom(run),side=selectionSide(run);
    if(point===null||!side)return null;
    const margin=side==='home'?h-a:a-h,graded=margin+point;
    if(Math.abs(graded)<1e-9)return 'push';
    return graded>0?'win':'loss';
  }
  if(market==='Total'){
    const point=pointFrom(run);
    if(point===null)return null;
    const total=h+a;
    if(Math.abs(total-point)<1e-9)return 'push';
    if(isOver(run))return total>point?'win':'loss';
    if(isUnder(run))return total<point?'win':'loss';
  }
  return null;
}
function probabilityBand(p:number){
  const pct=p*100;
  if(pct<65)return '<65';
  if(pct<70)return '65-69';
  if(pct<75)return '70-74';
  if(pct<80)return '75-79';
  if(pct<85)return '80-84';
  if(pct<90)return '85-89';
  return '90+';
}

export async function settleCompletedModelRuns(gameResults:CompletedEventResult[],playerResults:PlayerStatResult[]=[]){
  const sql=db();
  if(!sql)return {configured:false,matchedEvents:0,settled:0,pushes:0,playerPropsSettled:0,skipped:0};

  for(const result of gameResults){
    await sql`
      insert into event_results(event_id,provider_event_id,sport,home_team,away_team,home_score,away_score,completed,provider,source_timestamp,raw)
      values(${null},${result.providerEventId},${result.sport},${result.home},${result.away},${result.homeScore},${result.awayScore},${result.completed},${result.provider},${result.sourceTimestamp},${sql.json(result.raw as any)})
      on conflict (provider,provider_event_id) do update set
        home_score=excluded.home_score,away_score=excluded.away_score,completed=excluded.completed,
        source_timestamp=excluded.source_timestamp,raw=excluded.raw,recorded_at=now()
    `;
  }
  for(const result of playerResults){
    await sql`
      insert into player_result_snapshots(provider_event_id,sport,player_name,team_name,stats,provider,source_timestamp,raw)
      values(${result.providerEventId||null},${result.sport||null},${result.player},${result.team||null},${sql.json(result.stats as any)},${result.provider},${result.sourceTimestamp},${sql.json(result.raw as any)})
    `;
  }

  const rows=await sql`
    select mr.id as "modelRunId",mr.event_id as "eventId",mr.market_key as "marketKey",mr.selection_key as "selectionKey",
      mr.model_version as "modelVersion",mr.model_probability::float as "modelProbability",
      mr.simulation_probability::float as "simulationProbability",mr.simulation_mode as "simulationMode",
      mr.created_at as "createdAt",mr.feature_snapshot as "featureSnapshot",
      e.sport,coalesce(e.home_team_id,'') as home,coalesce(e.away_team_id,'') as away,e.start_time as "startTime"
    from model_runs mr
    join events e on e.id=mr.event_id
    left join bet_results br on br.model_run_id=mr.id
    where br.id is null and e.start_time < now() and e.start_time > now()-interval '14 days'
    order by e.start_time asc,mr.created_at asc
    limit 5000
  ` as unknown as PendingRun[];

  let settled=0,pushes=0,playerPropsSettled=0,skipped=0;
  const matched=new Set<string>();
  for(const run of rows){
    const market=canonicalMarket(run);
    let graded:'win'|'loss'|'push'|null=null;
    let sourceProvider='',sourceEventId='',sourceRaw:unknown={};
    let resolvedPropType:string|null=null,resolvedPlayer:string|null=null,actualValue:number|null=null;

    if(market==='Player Prop'){
      const result=findPlayerResult(run,playerResults);
      if(!result){skipped++;continue}
      const propGrade=gradePlayerProp(run,result);
      if(!propGrade){skipped++;continue}
      graded=propGrade.grade;resolvedPropType=propGrade.type;actualValue=propGrade.actual;resolvedPlayer=playerName(run);
      sourceProvider=result.provider;sourceEventId=result.providerEventId;sourceRaw=result.raw;
      playerPropsSettled++;
    }else{
      const result=findResult(run,gameResults);
      if(!result){skipped++;continue}
      graded=gradeGame(run,result);
      if(!graded){skipped++;continue}
      sourceProvider=result.provider;sourceEventId=result.providerEventId;sourceRaw=result.raw;
    }

    matched.add(run.eventId);
    const snap=run.featureSnapshot||{};
    let offeredOdds=numberValue(snap.offeredOdds);
    if(offeredOdds===null){
      const nearest=await sql`
        select american_odds from market_snapshots
        where event_id=${run.eventId} and market_key=${run.marketKey} and selection_key=${run.selectionKey}
        order by abs(extract(epoch from (pulled_at-${run.createdAt}::timestamptz))) asc limit 1
      ` as unknown as Array<{american_odds:number}>;
      offeredOdds=nearest[0]?.american_odds??null;
    }
    const closing=await sql`
      select american_odds from market_snapshots
      where event_id=${run.eventId} and market_key=${run.marketKey} and selection_key=${run.selectionKey}
        and pulled_at <= ${run.startTime}::timestamptz
      order by pulled_at desc limit 1
    ` as unknown as Array<{american_odds:number}>;
    const closingOdds=closing[0]?.american_odds??null;
    const p=run.simulationProbability??run.modelProbability,stake=1;
    const pnl=graded==='push'?0:graded==='win'&&offeredOdds!==null?stake*(americanToDecimal(offeredOdds)-1):-stake;
    const clv=offeredOdds!==null&&closingOdds!==null?clvFromOdds(offeredOdds,closingOdds):null;

    await sql`
      insert into bet_results(
        model_run_id,event_id,market_key,selection_key,offered_odds,closing_odds,result,clv,pnl,settled_at,
        simulation_probability,model_probability,simulation_mode,probability_band,unit_stake,result_source,source_event_id,raw,
        player_name,prop_type,actual_value
      ) values(
        ${run.modelRunId},${run.eventId},${run.marketKey},${run.selectionKey},${offeredOdds},${closingOdds},${graded},${clv},${pnl},now(),
        ${run.simulationProbability},${run.modelProbability},${run.simulationMode},${probabilityBand(p)},${stake},${sourceProvider},${sourceEventId||null},${sql.json(sourceRaw as any)},
        ${resolvedPlayer},${resolvedPropType},${actualValue}
      ) on conflict (model_run_id) do nothing
    `;
    await sql`
      update weekly_parlay_legs set result=${graded},updated_at=now()
      where result='pending' and coalesce(raw->>'eventId','')=${run.eventId} and selection=${run.selectionKey}
    `;
    if(graded==='push')pushes++; else settled++;
  }

  for(const eventId of matched)await sql`update events set status='completed' where id=${eventId}`;
  return {configured:true,matchedEvents:matched.size,settled,pushes,playerPropsSettled,skipped};
}
