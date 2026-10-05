import {createHash} from 'node:crypto';
import {db} from './db';
import type {Market} from './types';
import type {Scanned} from './scanner';
import {fetchStatsContext} from './providers/context';

type AnyRow=Record<string,unknown>;

type NormalizedPlayerGame={
 athleteId:string;
 sourceId?:string;
 name:string;
 normalizedName:string;
 sport:string;
 team?:string;
 position?:string;
 eventId:string;
 statDate:string;
 opponent?:string;
 homeAway?:string;
 minutes?:number;
 usageRate?:number;
 starter?:boolean;
 stats:Record<string,number>;
 raw:AnyRow;
};

type StatSummary={
 mean:number;
 stdDev:number;
 min:number;
 max:number;
 last:number;
 sampleSize:number;
};

type FeatureSnapshot={
 games:number;
 stats:Record<string,StatSummary>;
};

export type PlayerWarehouseSyncResult={
 configured:boolean;
 providerId?:string;
 rowsSeen:number;
 gamesWritten:number;
 athletesTouched:number;
 featureSnapshotsWritten:number;
 error?:string;
};

const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const arr=(payload:unknown):unknown[]=>{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const key of ['data','results','players','athletes','games','rows','items']){
  if(Array.isArray(root[key]))return root[key] as unknown[];
 }
 return [];
};
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const numeric=(v:unknown)=>{
 const n=typeof v==='number'?v:Number(v);
 return Number.isFinite(n)?n:undefined;
};
const booleanish=(v:unknown)=>{
 if(typeof v==='boolean')return v;
 if(typeof v==='number')return v!==0;
 if(typeof v==='string'){
  const s=v.toLowerCase();
  if(['true','yes','1','starter','starting','started'].includes(s))return true;
  if(['false','no','0','bench','reserve','substitute'].includes(s))return false;
 }
 return undefined;
};
export const normalizePlayerName=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const normalizeKey=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'');
const stableId=(sport:string,name:string)=>'ath-'+createHash('sha1').update(sport.toLowerCase()+'|'+normalizePlayerName(name)).digest('hex').slice(0,20);

function parseDate(row:AnyRow){
 const value=row.statDate??row.stat_date??row.gameDate??row.game_date??row.date??row.startTime??row.start_time??row.commence_time;
 if(typeof value==='number'){
  const d=new Date(value>1e12?value:value*1000);
  if(Number.isFinite(d.getTime()))return d.toISOString();
 }
 const text=str(value);
 if(text){
  const d=new Date(text);
  if(Number.isFinite(d.getTime()))return d.toISOString();
 }
 return new Date().toISOString();
}

function numericStats(row:AnyRow){
 const nested=[
  obj(row.stats),obj(row.statistics),obj(row.boxScore),obj(row.box_score),obj(row.statLine),obj(row.stat_line)
 ];
 const out:Record<string,number>={};
 for(const source of nested){
  for(const [key,value] of Object.entries(source)){
   const n=numeric(value);
   if(n!==undefined)out[normalizeKey(key)]=n;
  }
 }
 const directKeys=[
  'points','rebounds','assists','steals','blocks','turnovers','minutes','usage',
  'passingYards','passing_yards','passingTDs','passing_tds','rushingYards','rushing_yards',
  'receivingYards','receiving_yards','receptions','targets','carries',
  'hits','runs','rbi','homeRuns','home_runs','totalBases','total_bases','strikeouts','walks',
  'pitchingStrikeouts','pitching_strikeouts','inningsPitched','innings_pitched',
  'shots','shotsOnGoal','shots_on_goal','saves','goals','pointsScored','points_scored',
  'aces','doubleFaults','double_faults','gamesWon','games_won','setsWon','sets_won'
 ];
 for(const key of directKeys){
  const n=numeric(row[key]);
  if(n!==undefined)out[normalizeKey(key)]=n;
 }
 return out;
}

function normalizeRow(value:unknown,index:number,source:string):NormalizedPlayerGame|null{
 const row=obj(value);
 const nestedPlayer=obj(row.player||row.athlete);
 const name=str(row.playerName??row.player_name??row.athleteName??row.athlete_name??nestedPlayer.name??row.name);
 const sport=str(row.sport??row.league??nestedPlayer.sport);
 if(!name||!sport)return null;
 const normalizedName=normalizePlayerName(name);
 const explicitId=str(row.playerId??row.player_id??row.athleteId??row.athlete_id??nestedPlayer.id);
 const athleteId=explicitId||stableId(sport,name);
 const statDate=parseDate(row);
 const opponent=str(row.opponent??row.opponentName??row.opponent_name);
 const eventId=str(row.eventId??row.event_id??row.gameId??row.game_id??row.matchId??row.match_id)
  ||'event-'+createHash('sha1').update([source,athleteId,statDate,opponent,index].join('|')).digest('hex').slice(0,22);
 const team=str(row.team??row.teamName??row.team_name??nestedPlayer.team);
 const position=str(row.position??nestedPlayer.position);
 const homeAway=str(row.homeAway??row.home_away??row.location);
 const minutes=numeric(row.minutes??row.minutesPlayed??row.minutes_played);
 const usageRate=numeric(row.usage??row.usageRate??row.usage_rate);
 const starter=booleanish(row.starter??row.isStarter??row.is_starter??row.starting??row.started);
 const stats=numericStats(row);
 if(!Object.keys(stats).length)return null;
 return {
  athleteId,sourceId:explicitId||undefined,name,normalizedName,sport,team:team||undefined,position:position||undefined,
  eventId,statDate,opponent:opponent||undefined,homeAway:homeAway||undefined,minutes,usageRate,starter,stats,raw:row
 };
}

function summarize(values:number[]):StatSummary|null{
 if(!values.length)return null;
 const mean=values.reduce((s,x)=>s+x,0)/values.length;
 const variance=values.reduce((s,x)=>s+(x-mean)**2,0)/values.length;
 return {
  mean,
  stdDev:Math.sqrt(variance),
  min:Math.min(...values),
  max:Math.max(...values),
  last:values[0],
  sampleSize:values.length
 };
}

function featureSnapshot(rows:Array<{stats:AnyRow}>,limit:number):FeatureSnapshot{
 const selected=rows.slice(0,limit);
 const keys=new Set<string>();
 for(const row of selected)for(const key of Object.keys(obj(row.stats)))keys.add(key);
 const stats:Record<string,StatSummary>={};
 for(const key of keys){
  const values=selected.map(row=>numeric(obj(row.stats)[key])).filter((x):x is number=>x!==undefined);
  const summary=summarize(values);
  if(summary)stats[key]=summary;
 }
 return {games:selected.length,stats};
}

async function rebuildFeatures(sql:NonNullable<ReturnType<typeof db>>,athleteId:string,source:string){
 const rows=await sql`
  select stats
  from player_game_stats
  where athlete_id=${athleteId}
  order by stat_date desc
  limit 250
 `;
 if(!rows.length)return 0;
 let written=0;
 const windows:Array<[string,number]>=[['LAST_5',5],['LAST_10',10],['LAST_20',20],['ALL',250]];
 for(const [label,limit] of windows){
  const features=featureSnapshot(rows as unknown as Array<{stats:AnyRow}>,limit);
  await sql`
   insert into player_features(athlete_id,as_of,source_window,features,sample_size,source)
   values(${athleteId},now(),${label},${sql.json(features)},${features.games},${source})
  `;
  written++;
 }
 return written;
}

export async function ingestPlayerHistoryPayload(payload:unknown,source='stats-provider'):Promise<PlayerWarehouseSyncResult>{
 const sql=db();
 const rawRows=arr(payload);
 if(!sql)return {configured:false,providerId:source,rowsSeen:rawRows.length,gamesWritten:0,athletesTouched:0,featureSnapshotsWritten:0,error:'database not configured'};
 const normalized=rawRows.map((row,index)=>normalizeRow(row,index,source)).filter((x):x is NormalizedPlayerGame=>Boolean(x));
 const touched=new Set<string>();
 let gamesWritten=0;

 for(const row of normalized){
  await sql`
   insert into athletes(id,source_id,name,normalized_name,sport,team,position,metadata,last_seen_at)
   values(${row.athleteId},${row.sourceId??null},${row.name},${row.normalizedName},${row.sport},${row.team??null},${row.position??null},'{}'::jsonb,now())
   on conflict (id) do update set
    source_id=coalesce(excluded.source_id,athletes.source_id),
    name=excluded.name,normalized_name=excluded.normalized_name,sport=excluded.sport,
    team=coalesce(excluded.team,athletes.team),position=coalesce(excluded.position,athletes.position),
    last_seen_at=now()
  `;
  await sql`
   insert into athlete_aliases(athlete_id,alias,normalized_alias,source)
   values(${row.athleteId},${row.name},${row.normalizedName},${source})
   on conflict (athlete_id,normalized_alias) do nothing
  `;
  const inserted=await sql`
   insert into player_game_stats(
    athlete_id,event_id,stat_date,opponent,home_away,team,minutes,usage_rate,starter,stats,source,raw
   ) values(
    ${row.athleteId},${row.eventId},${row.statDate},${row.opponent??null},${row.homeAway??null},
    ${row.team??null},${row.minutes??null},${row.usageRate??null},${row.starter??null},${sql.json(row.stats)},${source},${sql.json(row.raw as any)}
   )
   on conflict (athlete_id,event_id,source) do update set
    stat_date=excluded.stat_date,opponent=excluded.opponent,home_away=excluded.home_away,
    team=excluded.team,minutes=excluded.minutes,usage_rate=excluded.usage_rate,starter=excluded.starter,
    stats=excluded.stats,raw=excluded.raw,ingested_at=now()
   returning id
  `;
  gamesWritten+=inserted.length;
  touched.add(row.athleteId);
 }

 const latestRoster=new Map<string,NormalizedPlayerGame>();
 for(const row of normalized){
  const prior=latestRoster.get(row.athleteId);
  if(!prior||new Date(row.statDate).getTime()>new Date(prior.statDate).getTime())latestRoster.set(row.athleteId,row);
 }
 const observedHour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 for(const row of latestRoster.values()){
  try{
   await sql\`
    insert into player_roster_snapshots(athlete_id,sport,team,position,roster_status,source,observed_hour,metadata)
    values(\${row.athleteId},\${row.sport},\${row.team??null},\${row.position??null},'ACTIVE',\${source},\${observedHour},\${sql.json({sourceId:row.sourceId||null,lastEventId:row.eventId})})
    on conflict (athlete_id,source,observed_hour) do update set
     sport=excluded.sport,team=excluded.team,position=excluded.position,metadata=excluded.metadata
   \`;
  }catch{
   // Roster continuity is supplemental and must not block player-history ingestion during staged migrations.
  }
 }

 let featureSnapshotsWritten=0;
 for(const athleteId of touched)featureSnapshotsWritten+=await rebuildFeatures(sql,athleteId,source);
 return {
  configured:true,providerId:source,rowsSeen:rawRows.length,gamesWritten,
  athletesTouched:touched.size,featureSnapshotsWritten
 };
}

export async function syncPlayerWarehouseFromStatsProvider(){
 const result=await fetchStatsContext();
 if(!result.ok||result.data===undefined){
  return {
   configured:Boolean(result.attempts.length),
   providerId:result.providerId,
   rowsSeen:0,gamesWritten:0,athletesTouched:0,featureSnapshotsWritten:0,
   error:result.error||'stats provider unavailable'
  } satisfies PlayerWarehouseSyncResult;
 }
 return ingestPlayerHistoryPayload(result.data,result.providerId||result.providerName||'stats-provider');
}

function inferStatKey(market:string,selection:string){
 const text=(market+' '+selection).toLowerCase();
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
 for(const [re,key] of aliases)if(re.test(text))return key;
 return '';
}

function statFromFeature(features:AnyRow,statKey:string){
 const stats=obj(features.stats);
 const direct=obj(stats[normalizeKey(statKey)]);
 if(Object.keys(direct).length)return direct;
 return null;
}

export async function enrichMarketsWithPlayerWarehouse(markets:Market[]){
 const sql=db();
 const named=markets.filter(x=>x.playerContext?.name);
 if(!sql||!named.length)return {markets,matched:0,players:0};

 const normalizedNames=[...new Set(named.map(x=>normalizePlayerName(x.playerContext!.name)).filter(Boolean))];
 if(!normalizedNames.length)return {markets,matched:0,players:0};

 const athletes=await sql`
  select id,name,normalized_name as "normalizedName",sport
  from athletes
  where normalized_name in ${sql(normalizedNames)}
 `;
 if(!athletes.length)return {markets,matched:0,players:0};

 const ids=athletes.map((x:any)=>String(x.id));
 const featureRows=await sql`
  select distinct on (athlete_id,source_window)
   athlete_id as "athleteId",source_window as "sourceWindow",features,sample_size as "sampleSize",as_of as "asOf"
  from player_features
  where athlete_id in ${sql(ids)}
  order by athlete_id,source_window,as_of desc
 `;
 const byName=new Map<string,any>();
 for(const athlete of athletes as any[]){
  const windows=(featureRows as any[]).filter(x=>String(x.athleteId)===String(athlete.id));
  byName.set(String(athlete.normalizedName),{...athlete,windows});
 }

 let matched=0;
 const enriched=markets.map(m=>{
  const player=m.playerContext;
  if(!player?.name)return m;
  const profile=byName.get(normalizePlayerName(player.name));
  if(!profile)return m;
  const statKey=normalizeKey(player.statKey||inferStatKey(m.market,m.selection));
  if(!statKey)return m;
  const preferred=['LAST_10','LAST_20','ALL'];
  let summary:AnyRow|null=null;
  let windowLabel='';
  let sampleSize=0;
  for(const label of preferred){
   const window=profile.windows.find((x:any)=>x.sourceWindow===label);
   if(!window)continue;
   const found=statFromFeature(obj(window.features),statKey);
   if(found){
    summary=found;windowLabel=label;sampleSize=Number(window.sampleSize||found.sampleSize||0);break;
   }
  }
  if(!summary||sampleSize<3)return m;
  const histMean=numeric(summary.mean);
  const histStd=numeric(summary.stdDev);
  if(histMean===undefined)return m;

  const historyWeight=sampleSize>=20?.35:sampleSize>=10?.28:.20;
  const liveProjection=player.projection;
  const projection=liveProjection===undefined?histMean:liveProjection*(1-historyWeight)+histMean*historyWeight;
  const stdDev=player.stdDev??histStd;
  const sportFeatures={
   ...(m.sportFeatures||{}),
   propMean:projection,
   ...(stdDev!==undefined?{propStd:stdDev}:{}),
   historicalSampleSize:sampleSize,
   historicalMean:histMean
  };
  const contextSources=[...new Set([...(m.contextSources||[]),'player-history-db'])];
  const contextProvenance=[
   ...(m.contextProvenance||[]),
   {
    source:'player-history-db',
    providerId:'edgeforce-player-warehouse',
    field:'player.'+statKey+'.'+windowLabel.toLowerCase(),
    observedAt:new Date().toISOString(),
    confidence:sampleSize>=20?.94:sampleSize>=10?.88:.78,
    status:'CACHED' as const,
    detail:{sampleSize,mean:histMean,stdDev:histStd,window:windowLabel}
   }
  ];
  matched++;
  return {
   ...m,
   sportFeatures,
   contextSources,
   contextProvenance,
   playerContext:{...player,projection,stdDev,statKey:player.statKey||statKey}
  };
 });
 return {markets:enriched,matched,players:byName.size};
}

function parseLine(m:Market){
 const values=[...`${m.market} ${m.selection}`.matchAll(/([+-]?\d+(?:\.\d+)?)/g)]
  .map(x=>Number(x[1])).filter(Number.isFinite);
 return values.length?values[values.length-1]:undefined;
}

export async function recordPlayerPropSnapshots(rows:Scanned[]){
 const sql=db();
 if(!sql)return 0;
 const props=rows.filter(x=>x.playerContext?.name);
 if(!props.length)return 0;
 const names=[...new Set(props.map(x=>normalizePlayerName(x.playerContext!.name)))];
 const athletes=await sql`
  select id,normalized_name as "normalizedName"
  from athletes
  where normalized_name in ${sql(names)}
 `;
 const athleteByName=new Map((athletes as any[]).map(x=>[String(x.normalizedName),String(x.id)]));
 const observedHour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 let written=0;

 for(const row of props){
  const text=(row.market+' '+row.selection).toLowerCase();
  const direction=text.includes('under')?'UNDER':text.includes('over')?'OVER':'OTHER';
  const line=parseLine(row);
  const playerName=row.playerContext!.name;
  const athleteId=athleteByName.get(normalizePlayerName(playerName));
  const eventId=row.id.includes(':')?row.id.split(':')[0]:row.id;
  const statKey=normalizeKey(row.playerContext?.statKey||inferStatKey(row.market,row.selection));
  const venue=row.sourceBook||row.consensus?.bestBook||'Unknown';
  const inserted=await sql`
   insert into player_prop_predictions(
    market_id,athlete_id,player_name,sport,event_id,event_label,stat_key,direction,line,venue,
    offered_odds,model_probability,sim_probability,dynamic_confidence,observed_hour,raw
   ) values(
    ${row.id},${athleteId??null},${playerName},${row.sport},${eventId},${row.event},
    ${statKey||null},${direction},${line??null},${venue},${row.odds},${row.modelProb},
    ${row.simProbability},${row.dynamicConfidence},${observedHour},
    ${sql.json({market:row.market,selection:row.selection,sourceBook:row.sourceBook,consensus:row.consensus||null})}
   )
   on conflict (market_id,venue,observed_hour) do update set
    offered_odds=excluded.offered_odds,model_probability=excluded.model_probability,
    sim_probability=excluded.sim_probability,dynamic_confidence=excluded.dynamic_confidence,raw=excluded.raw
   returning id
  `;
  written+=inserted.length;
 }
 return written;
}

export type PlayerPropSettlement={
 eventId:string;
 marketKey?:string;
 selectionKey:string;
 result:'win'|'loss'|'push';
 closingOdds?:number;
 settledAt?:string;
};

export async function settlePlayerPropPredictions(results:PlayerPropSettlement[]){
 const sql=db();
 if(!sql)return {matched:0,settled:0};
 let matched=0;
 let settled=0;
 for(const result of results){
  const rows=await sql`
   update player_prop_predictions
   set result=${result.result},
       closing_odds=coalesce(${result.closingOdds??null},closing_odds),
       settled_at=${result.settledAt||new Date().toISOString()}
   where result is null
    and event_id=${result.eventId}
    and lower(coalesce(raw->>'selection',''))=lower(${result.selectionKey})
    and (
      ${result.marketKey??null}::text is null
      or lower(coalesce(raw->>'market',''))=lower(${result.marketKey??''})
    )
   returning id
  `;
  matched+=rows.length;
  settled+=rows.length;
 }
 return {matched,settled};
}

export async function loadPropPerformance(){
 const sql=db();
 if(!sql)return {configured:false,overall:[],sports:[],stats:[],directions:[],bands:[]};
 const rows=await sql`
  select sport,coalesce(stat_key,'unknown') as "statKey",direction,sim_probability::float as "simProbability",result
  from player_prop_predictions
  where result in ('win','loss','push')
 `;
 const source=rows as unknown as Array<{sport:string;statKey:string;direction:string;simProbability:number;result:string}>;
 const summarizeGroup=(keyFn:(row:typeof source[number])=>string)=>{
  const map=new Map<string,{key:string;count:number;wins:number;losses:number;pushes:number}>();
  for(const row of source){
   const key=keyFn(row);
   const item=map.get(key)||{key,count:0,wins:0,losses:0,pushes:0};
   item.count++;
   if(row.result==='win')item.wins++;
   else if(row.result==='loss')item.losses++;
   else item.pushes++;
   map.set(key,item);
  }
  return [...map.values()].map(x=>({...x,hitRate:(x.wins+x.losses)?x.wins/(x.wins+x.losses):0}))
   .sort((a,b)=>b.hitRate-a.hitRate||b.count-a.count);
 };
 const band=(p:number)=>{
  if(p>=.80)return '80%+';
  if(p>=.75)return '75-79.9%';
  if(p>=.70)return '70-74.9%';
  if(p>=.65)return '65-69.9%';
  if(p>=.60)return '60-64.9%';
  return '<60%';
 };
 return {
  configured:true,
  settled:source.length,
  overall:summarizeGroup(()=> 'ALL'),
  sports:summarizeGroup(x=>x.sport),
  stats:summarizeGroup(x=>x.sport+' • '+x.statKey),
  directions:summarizeGroup(x=>x.sport+' • '+x.direction),
  bands:summarizeGroup(x=>band(Number(x.simProbability||0)))
 };
}
