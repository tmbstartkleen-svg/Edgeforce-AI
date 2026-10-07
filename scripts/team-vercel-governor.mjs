import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const finiteNumber=(value,name)=>{
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error(`Invalid ${name}`);
  return n;
};

export function evaluateTeamGovernor({config,deployments,statuses,now=Date.now()}){
  if(!config||!Array.isArray(config.projects)||!Array.isArray(deployments)||!Array.isArray(statuses)){
    throw new Error('Invalid governor input');
  }
  const softCap=finiteNumber(config.softCap,'softCap');
  const hardCap=finiteNumber(config.hardCap,'hardCap');
  const reserve=finiteNumber(config.emergencyReserve,'emergencyReserve');
  const windowMs=finiteNumber(config.windowMs,'windowMs');
  const cooldown=finiteNumber(config.minProjectIntervalMs,'minProjectIntervalMs');
  const maxActions=Math.max(0,Math.floor(finiteNumber(config.maxActionsPerRun,'maxActionsPerRun')));
  if(softCap<0||hardCap<softCap||reserve!==hardCap-softCap) throw new Error('Invalid deployment budget partition');

  const cutoff=now-windowMs;
  const recent=deployments.filter(row=>Number(row?.created??row?.createdAt??0)>=cutoff);
  const usage=recent.length;
  const statusByKey=new Map(statuses.map(row=>[row.key,row]));
  const projects=config.projects.map(project=>{
    const status=statusByKey.get(project.key)||{};
    const lastDeploymentAt=Number(status.lastDeploymentAt||0);
    const active=Boolean(status.active);
    const cooldownReady=!lastDeploymentAt||now-lastDeploymentAt>=cooldown;
    const stale=project.mode==='workflow-dispatch'
      ? Boolean(status.headSha)&&status.headSha!==status.liveSha
      : Number(status.repoUpdatedAt||0)>lastDeploymentAt;
    const eligible=stale&&!active&&cooldownReady;
    return {
      ...project,
      stale,
      active,
      cooldownReady,
      eligible,
      lastDeploymentAt,
      headSha:status.headSha||null,
      liveSha:status.liveSha||null,
      repoUpdatedAt:Number(status.repoUpdatedAt||0)
    };
  });

  const remainingNormal=Math.max(0,softCap-usage);
  const slots=Math.min(maxActions,remainingNormal);
  const eligible=projects.filter(p=>p.eligible).sort((a,b)=>{
    const ageOrder=(a.lastDeploymentAt||0)-(b.lastDeploymentAt||0);
    if(ageOrder!==0) return ageOrder;
    return Number(b.priority||0)-Number(a.priority||0);
  });
  const selected=usage>=softCap?[]:eligible.slice(0,slots);
  const selectedKeys=new Set(selected.map(p=>p.key));
  const decisions=projects.map(project=>{
    let state='CURRENT';
    let reason='production already reflects the latest repository state';
    if(project.active){
      state='DEFERRED';
      reason='a release is already active';
    }else if(!project.stale){
      state='CURRENT';
    }else if(!project.cooldownReady){
      state='DEFERRED';
      reason='project cooldown is still active';
    }else if(usage>=softCap){
      state='DEFERRED';
      reason='team normal deployment budget is exhausted';
    }else if(!selectedKeys.has(project.key)){
      state='DEFERRED';
      reason='normal deployment slots are reserved for older pending projects';
    }else{
      state='APPROVED';
      reason=project.mode==='workflow-dispatch'
        ? 'dispatch guarded project release workflow'
        : 'deploy latest linked main branch through Vercel Git source';
    }
    return {...project,state,reason};
  });

  return {
    schemaVersion:config.schemaVersion,
    generatedAt:new Date(now).toISOString(),
    usage,
    softCap,
    hardCap,
    emergencyReserve:reserve,
    remainingNormal,
    reserveUntouched:Math.max(0,hardCap-Math.max(usage,softCap)),
    saturated:usage>=softCap,
    decisions
  };
}

function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const [mode,configFile,deploymentsFile,statusFile]=process.argv.slice(2);
    if(mode!=='plan') throw new Error('Usage: team-vercel-governor.mjs plan <config> <deployments> <statuses>');
    const result=evaluateTeamGovernor({
      config:readJson(configFile),
      deployments:readJson(deploymentsFile),
      statuses:readJson(statusFile)
    });
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(error){
    console.error(error instanceof Error?error.message:'Team Vercel governor failed');
    process.exitCode=1;
  }
}
