import {db} from './db';
import type {ContextProvenance,Market} from './types';
import {normalizePlayerName} from './playerWarehouse';

type AnyRow=Record<string,unknown>;

export type PlayerFrameGame={
 statDate:string;
 opponent?:string|null;
 homeAway?:string|null;
 team?:string|null;
 minutes?:number|null;
 usageRate?:number|null;
 stats:AnyRow;
};

export type PlayerFrameSignals={
 sampleSize:number;
 recent5Mean:number;
 recent20Mean:number;
 playerForm:number;
 playerVolatility:number;
 playerHomeAway:number;
 playerOpponent:number;
 playerUsage:number;
 playerRosterContinuity:number;
 playerSampleConfidence:number;
};

const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const num=(v:unknown)=>{
 const n=typeof v==='number'?v:Number(v);
 return Number.isFinite(n)?n:undefined;
};
const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,n));
const key=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'');
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const std=(xs:number[])=>{
 if(xs.length<2)return 0;
 const m=mean(xs);
 return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/xs.length);
};
const same=(a?:string|null,b?:string|null)=>Boolean(a&&b&&normalizePlayerName(a)===normalizePlayerName(b));

function inferStatKey(m:Market){
 const text=(m.playerContext?.statKey||m.market+' '+m.selection).toLowerCase();
 const aliases:Array<[RegExp,string]>=[
  [/passing\s*yards?/,'passingyards'],[/passing\s*(tds?|touchdowns?)/,'passingtds'],
  [/rushing\s*yards?/,'rushingyards'],[/receiving\s*yards?/,'receivingyards'],
  [/receptions?/,'receptions'],[/targets?/,'targets'],[/carries/,'carries'],
  [/pitch(?:er|ing).*strikeouts?|strikeouts?/,'strikeouts'],[/total\s*bases?/,'totalbases'],
  [/home\s*runs?/,'homeruns'],[/\brbi\b/,'rbi'],[/\bhits?\b/,'hits'],
  [/shots?\s*on\s*goal/,'shotsongoal'],[/\bsaves?\b/,'saves'],[/\bgoals?\b/,'goals'],
  [/\bpoints?\b/,'points'],[/rebounds?/,'rebounds'],[/assists?/,'assists'],
  [/three[- ]?pointers?|3[- ]?pointers?|threes?/,'threepointers'],
  [/\baces?\b/,'aces'],[/double\s*faults?/,'doublefaults'],[/games?\s*won/,'gameswon'],[/sets?\s*won/,'setswon']
 ];
 for(const [re,k] of aliases)if(re.test(text))return k;
 return key(m.playerContext?.statKey||'');
}

function statValue(game:PlayerFrameGame,statKey:string){
 const stats=obj(game.stats);
 const direct=num(stats[statKey]);
 if(direct!==undefined)return direct;
 for(const [k,v] of Object.entries(stats))if(key(k)===statKey){
  const n=num(v);
  if(n!==undefined)return n;
 }
 return undefined;
}

export function derivePlayerFeatureSignals(
 games:PlayerFrameGame[],
 statKey:string,
 currentHomeAway?:string,
 opponent?:string
):PlayerFrameSignals|null{
 const ordered=[...games].sort((a,b)=>new Date(b.statDate).getTime()-new Date(a.statDate).getTime());
 const usable=ordered.map(g=>({g,v:statValue(g,statKey)})).filter((x):x is {g:PlayerFrameGame;v:number}=>x.v!==undefined);
 if(usable.length<3)return null;
 const v20=usable.slice(0,20).map(x=>x.v);
 const v5=usable.slice(0,5).map(x=>x.v);
 const m20=mean(v20),m5=mean(v5),sd20=std(v20);
 const scale=Math.max(sd20,Math.abs(m20)*.12,1);
 const venue=currentHomeAway?usable.filter(x=>String(x.g.homeAway||'').toLowerCase().startsWith(currentHomeAway.toLowerCase().slice(0,1))).map(x=>x.v):[];
 const opp=opponent?usable.filter(x=>same(x.g.opponent,opponent)).map(x=>x.v):[];
 const usage20=usable.slice(0,20).map(x=>num(x.g.usageRate)).filter((x):x is number=>x!==undefined);
 const usage5=usable.slice(0,5).map(x=>num(x.g.usageRate)).filter((x):x is number=>x!==undefined);
 const recentTeams=usable.slice(0,10).map(x=>normalizePlayerName(String(x.g.team||''))).filter(Boolean);
 const currentTeam=recentTeams[0]||'';
 const continuity=recentTeams.length&&currentTeam?recentTeams.filter(x=>x===currentTeam).length/recentTeams.length:0;
 return {
  sampleSize:v20.length,
  recent5Mean:m5,
  recent20Mean:m20,
  playerForm:clamp((m5-m20)/scale),
  playerVolatility:clamp(sd20/Math.max(Math.abs(m20),1),0,1),
  playerHomeAway:venue.length>=2?clamp((mean(venue)-m20)/scale):0,
  playerOpponent:opp.length>=2?clamp((mean(opp)-m20)/scale):0,
  playerUsage:usage20.length>=3&&usage5.length?clamp((mean(usage5)-mean(usage20))/Math.max(Math.abs(mean(usage20))*.18,.02)):0,
  playerRosterContinuity:clamp(continuity,0,1),
  playerSampleConfidence:clamp(v20.length/20,0,1)
 };
}

function currentMatchup(m:Market,team?:string){
 if(team&&same(team,m.home))return {homeAway:'home',opponent:m.away};
 if(team&&same(team,m.away))return {homeAway:'away',opponent:m.home};
 return {homeAway:undefined,opponent:undefined};
}

export async function enrichMarketsWithPlayerFeatureFrames(markets:Market[]){
 const sql=db();
 const candidates=markets.filter(x=>x.playerContext?.name);
 if(!sql||!candidates.length)return {markets,matched:0,players:0,frames:[] as Array<Record<string,unknown>>};

 const names=[...new Set(candidates.map(x=>normalizePlayerName(x.playerContext!.name)).filter(Boolean))];
 const athletes=await sql`
  select id,name,normalized_name as "normalizedName",sport,team,position
  from athletes
  where normalized_name in ${sql(names)}
 `;
 if(!athletes.length)return {markets,matched:0,players:0,frames:[] as Array<Record<string,unknown>>};

 const ids=(athletes as any[]).map(x=>String(x.id));
 const rows=await sql`
  select athlete_id as "athleteId",stat_date as "statDate",opponent,home_away as "homeAway",team,
         minutes,usage_rate as "usageRate",stats
  from player_game_stats
  where athlete_id in ${sql(ids)}
  order by stat_date desc
  limit 3000
 `;
 const byAthlete=new Map<string,PlayerFrameGame[]>();
 for(const row of rows as any[]){
  const list=byAthlete.get(String(row.athleteId))||[];
  list.push({
   statDate:new Date(row.statDate).toISOString(),opponent:row.opponent,homeAway:row.homeAway,team:row.team,
   minutes:num(row.minutes),usageRate:num(row.usageRate),stats:obj(row.stats)
  });
  byAthlete.set(String(row.athleteId),list);
 }
 const byName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),x]));
 const frames:Array<Record<string,unknown>>=[];
 let matched=0;

 const enriched=markets.map(m=>{
  const player=m.playerContext;
  if(!player?.name)return m;
  const athlete=byName.get(normalizePlayerName(player.name));
  if(!athlete)return m;
  const statKey=inferStatKey(m);
  if(!statKey)return m;
  const games=byAthlete.get(String(athlete.id))||[];
  const matchup=currentMatchup(m,player.team||athlete.team);
  const signals=derivePlayerFeatureSignals(games,statKey,matchup.homeAway,matchup.opponent);
  if(!signals)return m;

  const sportFeatures={...(m.sportFeatures||{}),...signals};
  const provenance:ContextProvenance[]=[
   ...(m.contextProvenance||[]),
   {
    source:'player-feature-frame',
    providerId:'edgeforce-player-frames',
    field:'player.'+statKey+'.feature-frame',
    observedAt:new Date().toISOString(),
    confidence:.72+.24*signals.playerSampleConfidence,
    status:'CACHED',
    detail:{athleteId:String(athlete.id),sampleSize:signals.sampleSize,opponent:matchup.opponent,homeAway:matchup.homeAway}
   }
  ];
  const frame={
   marketId:m.id,athleteId:String(athlete.id),playerName:player.name,sport:m.sport,eventId:m.id.split(':')[0],
   statKey,sampleSize:signals.sampleSize,features:signals,
   currentContext:{homeAway:matchup.homeAway,opponent:matchup.opponent,weather:m.sportFeatures?.weather??0,team:player.team||athlete.team||null}
  };
  frames.push(frame);
  matched++;
  return {
   ...m,
   sportFeatures,
   contextSources:[...new Set([...(m.contextSources||[]),'player-feature-frame'])],
   contextProvenance:provenance
  };
 });

 return {markets:enriched,matched,players:byName.size,frames};
}

export async function recordPlayerFeatureFrames(markets:Market[]){
 const sql=db();
 if(!sql)return 0;
 const frameResult=await enrichMarketsWithPlayerFeatureFrames(markets);
 const observedHour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 let written=0;
 for(const frame of frameResult.frames as any[]){
  const inserted=await sql`
   insert into player_feature_frames(
    market_id,athlete_id,player_name,sport,event_id,stat_key,sample_size,features,current_context,model_version,observed_hour
   ) values(
    ${frame.marketId},${frame.athleteId},${frame.playerName},${frame.sport},${frame.eventId},${frame.statKey},
    ${frame.sampleSize},${sql.json(frame.features)},${sql.json(frame.currentContext)},${process.env.MODEL_VERSION||'edgeforce-v61'},${observedHour}
   )
   on conflict (market_id,player_name,observed_hour) do update set
    athlete_id=excluded.athlete_id,stat_key=excluded.stat_key,sample_size=excluded.sample_size,
    features=excluded.features,current_context=excluded.current_context,model_version=excluded.model_version
   returning id
  `;
  written+=inserted.length;
  await sql`
   insert into player_learning_state(
    athlete_id,sport,stat_key,sample_size,form_signal,volatility,home_away_signal,opponent_signal,usage_signal,roster_continuity,last_observed_at,features
   ) values(
    ${frame.athleteId},${frame.sport},${frame.statKey},${frame.sampleSize},
    ${frame.features.playerForm},${frame.features.playerVolatility},${frame.features.playerHomeAway},
    ${frame.features.playerOpponent},${frame.features.playerUsage},${frame.features.playerRosterContinuity},
    now(),${sql.json(frame.features)}
   )
   on conflict (athlete_id,sport,stat_key) do update set
    sample_size=excluded.sample_size,form_signal=excluded.form_signal,volatility=excluded.volatility,
    home_away_signal=excluded.home_away_signal,opponent_signal=excluded.opponent_signal,
    usage_signal=excluded.usage_signal,roster_continuity=excluded.roster_continuity,
    last_observed_at=now(),features=excluded.features
  `;
 }
 return written;
}

export async function loadPlayerFeatureFrameSummary(){
 const sql=db();
 if(!sql)return {configured:false,totalFrames:0,learningProfiles:0,rosterSnapshots:0,sports:[],top:[]};
 const [counts,sports,top]=await Promise.all([
  sql`
   select
    (select count(*)::int from player_feature_frames) as "totalFrames",
    (select count(*)::int from player_learning_state) as "learningProfiles",
    (select count(*)::int from player_roster_snapshots) as "rosterSnapshots"
  `,
  sql`
   select sport,count(*)::int as frames,count(distinct player_name)::int as players,
          avg((features->>'playerSampleConfidence')::numeric)::float as "sampleConfidence"
   from player_feature_frames
   where observed_hour>now()-interval '7 days'
   group by sport order by frames desc
  `,
  sql`
   select a.name as "playerName",pls.sport,pls.stat_key as "statKey",pls.sample_size as "sampleSize",
          pls.form_signal::float as "playerForm",pls.volatility::float as "playerVolatility",
          pls.home_away_signal::float as "playerHomeAway",pls.opponent_signal::float as "playerOpponent",
          pls.usage_signal::float as "playerUsage",pls.roster_continuity::float as "playerRosterContinuity",
          pls.last_observed_at as "lastObservedAt"
   from player_learning_state pls
   join athletes a on a.id=pls.athlete_id
   order by pls.last_observed_at desc
   limit 30
  `
 ]);
 const c=(counts as any[])[0]||{};
 return {configured:true,totalFrames:Number(c.totalFrames||0),learningProfiles:Number(c.learningProfiles||0),rosterSnapshots:Number(c.rosterSnapshots||0),sports,top};
}
