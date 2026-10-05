import {db} from './db';
import {RELEASE} from './releaseManifest';

export type IncidentPatternRow={
 primaryCause:string;
 severity:string;
 impactedComponents:string[];
 observedAt:string;
};

export type IncidentPatternProfile={
 cause:string;
 sampleSize:number;
 actionCount:number;
 watchCount:number;
 recurrenceScore:number;
 trendScore:number;
 cofailureComponents:string[];
 recommendedRunbook:string[];
 firstSeenAt:string|null;
 lastSeenAt:string|null;
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function buildIncidentPatternProfiles(rows:IncidentPatternRow[],now=new Date()):IncidentPatternProfile[]{
 const grouped=new Map<string,IncidentPatternRow[]>();
 for(const row of rows){
  const cause=String(row.primaryCause||'UNKNOWN');
  const list=grouped.get(cause)||[];
  list.push(row);
  grouped.set(cause,list);
 }
 const runbooks:Record<string,string[]>={
  DATABASE:['Verify connection saturation and latency history.','Review migrations and runtime database configuration.','Require two consecutive healthy database probes before release.'],
  MARKET_FRESHNESS:['Verify provider quota, circuit state, and source timestamps.','Force a live refresh before scanning.','Keep stale-market recommendations blocked until freshness recovers.'],
  CONSENSUS_FRESHNESS:['Inspect provider disagreement and missing consensus contributors.','Rebuild consensus after source recovery.','Use reduced-confidence fallback until multi-provider evidence returns.'],
  MODEL_FRESHNESS:['Inspect failed model jobs and recalibration history.','Retain the validated champion until a fresh candidate passes.','Require fresh model-run evidence before restoring normal confidence.'],
  AUTOMATION:['Inspect stale and failed automation jobs by dependency.','Replay only after fixing the upstream cause.','Verify injury, scan, decision, settlement, and recalibration schedules.'],
  RELIABILITY:['Inspect recurring open circuits by intelligence component.','Keep protective recommendation mode active during recovery.','Require successful half-open probes before restoring weights.'],
  RUNTIME_INCIDENTS:['Resolve ACTION incidents and identify the first failing subsystem.','Verify closure evidence in observability.','Do not reopen release flow until incident state and SLO state both clear.'],
  UNKNOWN:['Collect more incident evidence before automating remediation.']
 };

 const profiles:IncidentPatternProfile[]=[];
 for(const [cause,list] of grouped){
  list.sort((a,b)=>new Date(a.observedAt).getTime()-new Date(b.observedAt).getTime());
  const sampleSize=list.length;
  const actionCount=list.filter(x=>x.severity==='ACTION').length;
  const watchCount=list.filter(x=>x.severity==='WATCH').length;
  const recent7=list.filter(x=>now.getTime()-new Date(x.observedAt).getTime()<=7*86400000).length;
  const prior23=Math.max(0,sampleSize-recent7);
  const recentRate=recent7/7;
  const priorRate=prior23/23;
  const trendScore=clamp(.5+(recentRate-priorRate)*.35);
  const recurrenceScore=clamp(
   Math.min(1,sampleSize/8)*.45+
   (actionCount/Math.max(1,sampleSize))*.35+
   trendScore*.20
  );
  const componentCounts=new Map<string,number>();
  for(const row of list)for(const component of row.impactedComponents||[])componentCounts.set(component,(componentCounts.get(component)||0)+1);
  const cofailureComponents=[...componentCounts.entries()]
   .sort((a,b)=>b[1]-a[1])
   .filter(([,n])=>n>=2)
   .slice(0,5)
   .map(([name])=>name);
  profiles.push({
   cause,sampleSize,actionCount,watchCount,recurrenceScore,trendScore,cofailureComponents,
   recommendedRunbook:runbooks[cause]||runbooks.UNKNOWN,
   firstSeenAt:list[0]?.observedAt||null,
   lastSeenAt:list.at(-1)?.observedAt||null
  });
 }
 return profiles.sort((a,b)=>b.recurrenceScore-a.recurrenceScore);
}

async function loadRows():Promise<IncidentPatternRow[]>{
 const sql=db();if(!sql)return [];
 try{
  const rows=await sql`
   select primary_cause as "primaryCause",severity,impacted_components as "impactedComponents",observed_at as "observedAt"
   from incident_attribution_snapshots
   where observed_at>=now()-interval '30 days'
   order by observed_at asc
  `;
  return (rows as any[]).map(row=>({
   primaryCause:String(row.primaryCause||'UNKNOWN'),
   severity:String(row.severity||'INFO'),
   impactedComponents:Array.isArray(row.impactedComponents)?row.impactedComponents.map(String):[],
   observedAt:new Date(row.observedAt).toISOString()
  }));
 }catch{return []}
}

export async function buildIncidentPatternLearning(){
 const rows=await loadRows();
 const profiles=buildIncidentPatternProfiles(rows);
 const dominant=profiles[0]||null;
 const high=profiles.filter(x=>x.recurrenceScore>=.72).length;
 const systemRisk=high>=2||dominant?.recurrenceScore>=.86?'HIGH':high||dominant?.recurrenceScore>=.62?'ELEVATED':'NORMAL';
 return {
  generatedAt:new Date().toISOString(),
  windowDays:30,
  totalIncidents:rows.length,
  dominantCause:dominant?.cause||'NONE',
  recurrenceScore:dominant?.recurrenceScore||0,
  systemRisk,
  profiles,
  notes:[
   'Recurrence learning uses durable V75 incident-attribution history only.',
   'Runbooks are bounded operational guidance and never bypass release, SLO, or model-governance gates.'
  ]
 };
}

export async function persistIncidentPatternLearning(report:Awaited<ReturnType<typeof buildIncidentPatternLearning>>){
 const sql=db();if(!sql)return {persisted:false};
 for(const p of report.profiles){
  await sql`
   insert into incident_pattern_profiles(
    cause,sample_size,action_count,watch_count,recurrence_score,trend_score,cofailure_components,recommended_runbook,first_seen_at,last_seen_at,updated_at
   ) values(
    ${p.cause},${p.sampleSize},${p.actionCount},${p.watchCount},${p.recurrenceScore},${p.trendScore},
    ${sql.json(p.cofailureComponents)},${sql.json(p.recommendedRunbook)},${p.firstSeenAt},${p.lastSeenAt},now()
   )
   on conflict(cause) do update set
    sample_size=excluded.sample_size,action_count=excluded.action_count,watch_count=excluded.watch_count,
    recurrence_score=excluded.recurrence_score,trend_score=excluded.trend_score,
    cofailure_components=excluded.cofailure_components,recommended_runbook=excluded.recommended_runbook,
    first_seen_at=excluded.first_seen_at,last_seen_at=excluded.last_seen_at,updated_at=now()
  `;
 }
 await sql`
  insert into incident_pattern_snapshots(model_version,dominant_cause,recurrence_score,system_risk,profiles)
  values(${RELEASE.modelVersion},${report.dominantCause},${report.recurrenceScore},${report.systemRisk},${sql.json(report.profiles as any)})
 `;
 return {persisted:true};
}

export async function runIncidentPatternLearning(){
 const report=await buildIncidentPatternLearning();
 const persistence=await persistIncidentPatternLearning(report);
 return {...report,persistence};
}

export async function loadIncidentPatternSummary(){
 const current=await buildIncidentPatternLearning();
 const sql=db();if(!sql)return {...current,recent:[]};
 try{
  const recent=await sql`
   select id,model_version as "modelVersion",dominant_cause as "dominantCause",recurrence_score::float as "recurrenceScore",
    system_risk as "systemRisk",generated_at as "generatedAt"
   from incident_pattern_snapshots order by generated_at desc limit 20
  `;
  return {...current,recent};
 }catch{return {...current,recent:[]}}
}
