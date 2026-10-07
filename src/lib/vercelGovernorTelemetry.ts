import 'server-only';
import {db} from '@/lib/db';
import governorConfig from '../../config/vercel-team-governor.json';

type Deployment = {
  id?:string;
  name?:string;
  created?:number;
  createdAt?:number;
  state?:string;
  target?:string|null;
  meta?:Record<string,unknown>;
};

type ProjectConfig = {
  key:string;
  projectId:string;
  projectName:string;
  repo:string;
  repoId:number;
  mode:string;
  workflow?:string;
  priority:number;
};

type ProjectState = {
  key:string;
  projectName:string;
  usage:number;
  ready:number;
  canceled:number;
  error:number;
  active:number;
  latestDeploymentAt:number;
  latestProductionAt:number;
  repoUpdatedAt:number;
  cooldownReady:boolean;
  pending:boolean;
  governorState:'CURRENT'|'ACTIVE'|'APPROVED'|'DEFERRED';
  reason:string;
};

const config=governorConfig as typeof governorConfig & {projects:ProjectConfig[]};
const DAY=Number(config.windowMs);
const authHeaders=()=>({
  authorization:'Bearer '+(process.env.VERCEL_TOKEN||''),
  'content-type':'application/json'
});

function num(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0}
function createdAt(row:Deployment){return num(row.created??row.createdAt)}

async function json(url:string){
  const response=await fetch(url,{headers:authHeaders(),cache:'no-store'});
  if(!response.ok)throw new Error('Vercel telemetry request failed: '+response.status);
  return response.json() as Promise<any>;
}

async function fetchTeamDeployments(now:number){
  const cutoff=now-DAY;
  const collected:Deployment[]=[];
  let until:number|undefined;
  for(let page=0;page<6;page++){
    const params=new URLSearchParams({
      teamId:config.teamId,
      limit:'100',
      since:String(cutoff)
    });
    if(until)params.set('until',String(until));
    const payload=await json('https://api.vercel.com/v6/deployments?'+params.toString());
    const rows=(payload.deployments||payload.result?.deployments?.deployments||[]) as Deployment[];
    collected.push(...rows);
    const next=num(payload.pagination?.next??payload.result?.deployments?.pagination?.next);
    if(!next||rows.length===0)break;
    until=next;
    if(rows.some(row=>createdAt(row)<cutoff))break;
  }
  const seen=new Set<string>();
  return collected
    .filter(row=>createdAt(row)>=cutoff)
    .filter(row=>{
      const id=String(row.id||(String(row.name||'unknown')+'-'+createdAt(row)));
      if(seen.has(id))return false;
      seen.add(id);
      return true;
    });
}

async function repoUpdatedAt(project:ProjectConfig){
  try{
    const params=new URLSearchParams({
      provider:'github',
      query:project.repo,
      teamId:config.teamId
    });
    const payload=await json('https://api.vercel.com/v1/integrations/search-repo?'+params.toString());
    const match=(payload.repos||[]).find((row:any)=>row?.name===project.repo);
    return num(match?.updatedAt);
  }catch{return 0}
}

export function summarizeVercelGovernor(deployments:Deployment[],repoUpdates:Record<string,number>,now=Date.now()){
  const cutoff=now-DAY;
  const recent=deployments.filter(row=>createdAt(row)>=cutoff).sort((a,b)=>createdAt(a)-createdAt(b));
  const usage=recent.length;
  const softCap=Number(config.softCap);
  const hardCap=Number(config.hardCap);
  const emergencyReserve=Number(config.emergencyReserve);
  const normalRemaining=Math.max(0,softCap-usage);
  const reserveConsumed=Math.min(emergencyReserve,Math.max(0,usage-softCap));
  const overHardCap=Math.max(0,usage-hardCap);
  const slotsToRecover=usage>=softCap?usage-softCap+1:0;
  const recoveryAnchor=slotsToRecover>0?recent[slotsToRecover-1]:undefined;
  const nextNormalSlotAt=recoveryAnchor?new Date(createdAt(recoveryAnchor)+DAY).toISOString():null;

  const projectUsage:Record<string,number>={};
  const deploymentStates:Record<string,number>={};
  for(const row of recent){
    const name=String(row.name||'unknown');
    projectUsage[name]=(projectUsage[name]||0)+1;
    const state=String(row.state||'UNKNOWN').toUpperCase();
    deploymentStates[state]=(deploymentStates[state]||0)+1;
  }

  const projectStates:ProjectState[]=config.projects.map(project=>{
    const rows=recent.filter(row=>row.name===project.projectName);
    const desc=[...rows].sort((a,b)=>createdAt(b)-createdAt(a));
    const latest=desc[0];
    const latestProduction=desc.find(row=>row.target==='production'&&String(row.state).toUpperCase()==='READY');
    const latestDeploymentAt=latest?createdAt(latest):0;
    const latestProductionAt=latestProduction?createdAt(latestProduction):0;
    const repoTime=num(repoUpdates[project.key]);
    const stateCounts=(state:string)=>rows.filter(row=>String(row.state).toUpperCase()===state).length;
    const active=rows.filter(row=>['BUILDING','INITIALIZING','QUEUED'].includes(String(row.state).toUpperCase())).length;
    const cooldownReady=!latestDeploymentAt||now-latestDeploymentAt>=Number(config.minProjectIntervalMs);
    const pending=repoTime>latestDeploymentAt;
    let governorState:ProjectState['governorState']='CURRENT';
    let reason='production is current with the latest repository activity';
    if(active>0){
      governorState='ACTIVE';
      reason='a deployment is already active';
    }else if(!pending){
      governorState='CURRENT';
    }else if(!cooldownReady){
      governorState='DEFERRED';
      reason='project cooldown has not expired';
    }else if(usage>=softCap){
      governorState='DEFERRED';
      reason='team normal deployment budget is exhausted';
    }else{
      governorState='APPROVED';
      reason='pending project is eligible for the next governed release';
    }
    return {
      key:project.key,
      projectName:project.projectName,
      usage:rows.length,
      ready:stateCounts('READY'),
      canceled:stateCounts('CANCELED'),
      error:stateCounts('ERROR'),
      active,
      latestDeploymentAt,
      latestProductionAt,
      repoUpdatedAt:repoTime,
      cooldownReady,
      pending,
      governorState,
      reason
    };
  });

  return {
    schemaVersion:'v140-governor-telemetry-1',
    generatedAt:new Date(now).toISOString(),
    windowHours:DAY/3_600_000,
    usage,
    softCap,
    hardCap,
    emergencyReserve,
    normalRemaining,
    reserveConsumed,
    reserveRemaining:Math.max(0,emergencyReserve-reserveConsumed),
    overHardCap,
    slotsToRecover,
    nextNormalSlotAt,
    mode:overHardCap>0?'OVER_HARD_CAP':reserveConsumed>0?'EMERGENCY_RESERVE':usage>=softCap?'SATURATED':'NORMAL',
    projectUsage,
    deploymentStates,
    projectStates
  };
}

export async function getLiveVercelGovernorTelemetry(){
  if(!process.env.VERCEL_TOKEN)return {configured:false as const,telemetry:null,error:'VERCEL_TOKEN is not configured'};
  const now=Date.now();
  const [deployments,updates]=await Promise.all([
    fetchTeamDeployments(now),
    Promise.all(config.projects.map(async project=>[project.key,await repoUpdatedAt(project)] as const))
  ]);
  return {
    configured:true as const,
    telemetry:summarizeVercelGovernor(deployments,Object.fromEntries(updates),now),
    error:null
  };
}

export async function persistVercelGovernorSnapshot(telemetry:ReturnType<typeof summarizeVercelGovernor>){
  const sql=db();
  if(!sql)return {mode:'memory' as const,id:null,stored:false};
  try{
    const [latest]=await sql`
      select id,created_at as "createdAt"
      from vercel_governor_snapshots
      order by created_at desc limit 1
    `;
    if(latest?.createdAt&&Date.now()-new Date(latest.createdAt).getTime()<15*60*1000){
      return {mode:'database' as const,id:Number(latest.id),stored:false};
    }
    const [row]=await sql`
      insert into vercel_governor_snapshots(
        usage,soft_cap,hard_cap,emergency_reserve,normal_remaining,reserve_consumed,
        over_hard_cap,slots_to_recover,next_normal_slot_at,project_usage,project_states,deployment_states,source
      ) values(
        ${telemetry.usage},${telemetry.softCap},${telemetry.hardCap},${telemetry.emergencyReserve},
        ${telemetry.normalRemaining},${telemetry.reserveConsumed},${telemetry.overHardCap},
        ${telemetry.slotsToRecover},${telemetry.nextNormalSlotAt},
        ${sql.json(telemetry.projectUsage)},${sql.json(telemetry.projectStates as any)},
        ${sql.json(telemetry.deploymentStates)},'vercel-api'
      ) returning id
    `;
    return {mode:'database' as const,id:Number(row.id),stored:true};
  }catch{
    return {mode:'database' as const,id:null,stored:false};
  }
}

export async function recentVercelGovernorSnapshots(limit=24){
  const sql=db();
  if(!sql)return [];
  try{
    const rows=await sql`
      select id,usage,soft_cap as "softCap",hard_cap as "hardCap",
        emergency_reserve as "emergencyReserve",normal_remaining as "normalRemaining",
        reserve_consumed as "reserveConsumed",over_hard_cap as "overHardCap",
        slots_to_recover as "slotsToRecover",next_normal_slot_at as "nextNormalSlotAt",
        project_usage as "projectUsage",project_states as "projectStates",
        deployment_states as "deploymentStates",created_at as "createdAt"
      from vercel_governor_snapshots
      order by created_at desc
      limit ${Math.max(1,Math.min(96,limit))}
    `;
    return rows;
  }catch{return []}
}
