import {db} from './db';
import type {Scanned} from './scanner';

export type PregameChange={
  id:string;
  marketId:string;
  eventId:string;
  sport:string;
  event:string;
  selection:string;
  market:string;
  startTime:string;
  severity:'HIGH'|'MEDIUM';
  reasons:string[];
  previousSimulationProbability:number;
  currentSimulationProbability:number;
  detectedAt:string;
};

type PreviousRun={
  runId:number;
  eventId:string;
  marketKey:string;
  selectionKey:string;
  simulationProbability:number|null;
  modelProbability:number;
  featureSnapshot:Record<string,unknown>;
};

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>{
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v)))return Number(v);
  return undefined;
};
const cfg=(name:string,fallback:number)=>{
  const n=Number(process.env[name]);
  return Number.isFinite(n)?n:fallback;
};
const marketKey=(x:Scanned)=>x.marketKey||x.market;
const key=(eventId:string,market:string,selection:string)=>[eventId,market,selection].join('|');
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)};

export async function detectPregameChanges(rows:Scanned[]){
  const sql=db();
  if(!sql)return {configured:false,changes:[] as PregameChange[],detected:0,resimulated:0};

  const previousRows=await sql`
    select distinct on (mr.event_id,mr.market_key,mr.selection_key)
      mr.id as "runId",mr.event_id as "eventId",mr.market_key as "marketKey",mr.selection_key as "selectionKey",
      mr.simulation_probability::float as "simulationProbability",mr.model_probability::float as "modelProbability",
      mr.feature_snapshot as "featureSnapshot"
    from model_runs mr
    join events e on e.id=mr.event_id
    where e.start_time between now()-interval '2 hours' and now()+interval '8 days'
    order by mr.event_id,mr.market_key,mr.selection_key,mr.created_at desc
    limit 5000
  ` as unknown as PreviousRun[];

  const previous=new Map(previousRows.map(x=>[key(x.eventId,x.marketKey,x.selectionKey),x]));
  const changes:PregameChange[]=[];
  const detectedAt=new Date().toISOString();
  const oddsMove=cfg('PREGAME_ODDS_MOVE_THRESHOLD',10);
  const pointMove=cfg('PREGAME_POINT_MOVE_THRESHOLD',.5);
  const simMove=cfg('PREGAME_SIM_MOVE_THRESHOLD',.03);
  const weatherMove=cfg('PREGAME_WEATHER_MOVE_THRESHOLD',.10);
  const injuryMove=cfg('PREGAME_INJURY_MOVE_THRESHOLD',.05);
  const starterMove=cfg('PREGAME_STARTER_MOVE_THRESHOLD',.15);

  for(const row of rows){
    const eventId=row.eventId||row.id;
    const prev=previous.get(key(eventId,marketKey(row),row.selection));
    if(!prev)continue;

    const old=obj(prev.featureSnapshot);
    const oldFeatures=obj(old.sportFeatures);
    const reasons:string[]=[];
    const oldOdds=num(old.offeredOdds);
    const oldPoint=num(old.point);
    const oldSim=prev.simulationProbability??prev.modelProbability;
    const simDelta=row.simProbability-oldSim;

    if(oldOdds!==undefined&&Math.abs(row.odds-oldOdds)>=oddsMove)reasons.push('Odds moved '+(row.odds-oldOdds));
    if(oldPoint!==undefined&&typeof row.point==='number'&&Math.abs(row.point-oldPoint)>=pointMove)reasons.push('Line moved '+(row.point-oldPoint).toFixed(1));
    if(Math.abs(simDelta)>=simMove)reasons.push('Simulation moved '+(simDelta*100).toFixed(1)+' pts');

    const compare=(name:string,label:string,min:number)=>{
      const before=num(oldFeatures[name]),after=num((row.sportFeatures||{})[name]);
      if(before!==undefined&&after!==undefined&&Math.abs(after-before)>=min)reasons.push(label+' changed');
    };
    compare('weather','Weather',weatherMove);
    compare('injury','Injury impact',injuryMove);
    compare('starter','Starter edge',starterMove);
    compare('availabilityShock','Availability',injuryMove);

    const flagChanged=(name:string,label:string)=>{
      const before=num(oldFeatures[name]),after=num((row.sportFeatures||{})[name]);
      if(before!==undefined&&after!==undefined&&before!==after)reasons.push(label+' changed');
    };
    flagChanged('lineupConfirmed','Lineup');
    flagChanged('starterConfirmed','Starter');
    if(num((row.sportFeatures||{}).starterChanged)===1&&num(oldFeatures.starterChanged)!==1)reasons.push('Starter changed');

    const oldProjection=num(old.projectionMean);
    if(oldProjection!==undefined&&typeof row.projectionMean==='number'&&Math.abs(row.projectionMean-oldProjection)>=.5){
      reasons.push('Player projection moved');
    }

    if(!reasons.length)continue;

    const severity:'HIGH'|'MEDIUM'=Math.abs(simDelta)>=.05||reasons.some(x=>/Starter|Lineup|Injury|Availability/.test(x))?'HIGH':'MEDIUM';
    const snapshot={
      odds:row.odds,point:row.point??null,sim:row.simProbability,projectionMean:row.projectionMean??null,
      sportFeatures:row.sportFeatures||{}
    };
    const id=hash(JSON.stringify({eventId,market:marketKey(row),selection:row.selection,previousRun:prev.runId,snapshot,reasons}));
    const change:PregameChange={
      id,marketId:row.id,eventId,sport:row.sport,event:row.event,selection:row.selection,market:row.market,startTime:row.startTime,
      severity,reasons,previousSimulationProbability:oldSim,currentSimulationProbability:row.simProbability,detectedAt
    };
    changes.push(change);

    await sql`
      insert into pregame_change_events(
        signature,event_id,market_id,market_key,selection_key,sport,severity,reasons,previous_run_id,
        previous_simulation_probability,current_simulation_probability,before_snapshot,after_snapshot,detected_at
      ) values(
        ${id},${eventId},${row.id},${marketKey(row)},${row.selection},${row.sport},${severity},${sql.json(reasons as any)},${prev.runId},
        ${oldSim},${row.simProbability},${sql.json(old as any)},${sql.json(snapshot as any)},${detectedAt}
      ) on conflict (signature) do nothing
    `;
  }

  return {configured:true,changes:changes.slice(0,30),detected:changes.length,resimulated:changes.length};
}
