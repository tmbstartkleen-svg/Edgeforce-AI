import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const finiteNumber=(value,name)=>{
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error(`Invalid ${name}`);
  return n;
};

const createdAt=row=>Number(row?.created??row?.createdAt??0);

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
  const fairness=config.fairness||{};
  const agingPointsPerHour=finiteNumber(fairness.agingPointsPerHour??10,'agingPointsPerHour');
  const maxAgingPoints=finiteNumber(fairness.maxAgingPoints??240,'maxAgingPoints');
  const underBudgetPointsPerSlot=finiteNumber(fairness.underBudgetPointsPerSlot??12,'underBudgetPointsPerSlot');
  const maxUnderBudgetPoints=finiteNumber(fairness.maxUnderBudgetPoints??300,'maxUnderBudgetPoints');
  const overBudgetPenaltyPerSlot=finiteNumber(fairness.overBudgetPenaltyPerSlot??25,'overBudgetPenaltyPerSlot');
  const maxBorrowedActionsPerRun=Math.max(0,Math.floor(finiteNumber(fairness.maxBorrowedActionsPerRun??1,'maxBorrowedActionsPerRun')));
  if(softCap<0||hardCap<softCap||reserve!==hardCap-softCap) throw new Error('Invalid deployment budget partition');

  const configuredShares=config.projects.reduce((sum,p)=>sum+finiteNumber(p.normalBudgetShare??0,p.key+' normalBudgetShare'),0);
  if(configuredShares!==softCap) throw new Error('Project normalBudgetShare values must sum to softCap');

  const cutoff=now-windowMs;
  const recent=deployments.filter(row=>createdAt(row)>=cutoff);
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
    const certificationReady=project.mode==='workflow-dispatch'
      ? status.headCertified===true&&status.catchUpEligible===true
      : true;
    const projectUsage24h=recent.filter(row=>row?.name===project.projectName).length;
    const normalBudgetShare=finiteNumber(project.normalBudgetShare,project.key+' normalBudgetShare');
    const budgetRemaining=Math.max(0,normalBudgetShare-projectUsage24h);
    const overBudgetBy=Math.max(0,projectUsage24h-normalBudgetShare);
    const budgetState=projectUsage24h<normalBudgetShare?'UNDER_SHARE':projectUsage24h===normalBudgetShare?'AT_SHARE':'OVER_SHARE';
    const waitMs=Math.max(0,now-(lastDeploymentAt||cutoff));
    const waitHours=waitMs/3_600_000;
    const agingScore=Math.min(maxAgingPoints,waitHours*agingPointsPerHour);
    const underBudgetScore=Math.min(maxUnderBudgetPoints,budgetRemaining*underBudgetPointsPerSlot);
    const overBudgetPenalty=overBudgetBy*overBudgetPenaltyPerSlot;
    const fairnessScore=Number((
      finiteNumber(project.priority??0,project.key+' priority')*10+
      agingScore+
      underBudgetScore-
      overBudgetPenalty
    ).toFixed(2));
    const eligible=stale&&!active&&cooldownReady&&certificationReady;
    return {
      ...project,
      stale,
      active,
      cooldownReady,
      eligible,
      lastDeploymentAt,
      headSha:status.headSha||null,
      liveSha:status.liveSha||null,
      repoUpdatedAt:Number(status.repoUpdatedAt||0),
      certificationReady,
      headCertified:status.headCertified===true,
      catchUpEligible:status.catchUpEligible===true,
      backlogDepth:Number(status.backlogDepth||0),
      certifiedBacklogDepth:Number(status.certifiedBacklogDepth||0),
      backlogAgeMinutes:Number(status.backlogAgeMinutes||0),
      latestCertifiedSha:status.latestCertifiedSha||null,
      backlogReason:status.backlogReason||null,
      projectUsage24h,
      normalBudgetShare,
      budgetRemaining,
      overBudgetBy,
      budgetState,
      waitHours:Number(waitHours.toFixed(2)),
      agingScore:Number(agingScore.toFixed(2)),
      underBudgetScore:Number(underBudgetScore.toFixed(2)),
      overBudgetPenalty:Number(overBudgetPenalty.toFixed(2)),
      fairnessScore
    };
  });

  const compare=(a,b)=>{
    if(a.fairnessScore!==b.fairnessScore)return b.fairnessScore-a.fairnessScore;
    const ageOrder=(a.lastDeploymentAt||0)-(b.lastDeploymentAt||0);
    if(ageOrder!==0)return ageOrder;
    return String(a.key).localeCompare(String(b.key));
  };
  const underShare=projects.filter(p=>p.eligible&&p.budgetState!=='OVER_SHARE').sort(compare);
  const overShare=projects.filter(p=>p.eligible&&p.budgetState==='OVER_SHARE').sort(compare);
  const ranked=[...underShare,...overShare];
  const rankByKey=new Map(ranked.map((p,index)=>[p.key,index+1]));

  const remainingNormal=Math.max(0,softCap-usage);
  const slots=Math.min(maxActions,remainingNormal);
  const selected=[];
  if(usage<softCap&&slots>0){
    selected.push(...underShare.slice(0,slots));
    const borrowedSlots=Math.min(maxBorrowedActionsPerRun,Math.max(0,slots-selected.length));
    if(borrowedSlots>0)selected.push(...overShare.slice(0,borrowedSlots));
  }
  const selectedKeys=new Set(selected.map(p=>p.key));

  const decisions=projects.map(project=>{
    let state='CURRENT';
    let reason='production already reflects the latest repository state';
    const borrowedCapacity=selectedKeys.has(project.key)&&project.budgetState==='OVER_SHARE';
    if(project.active){
      state='DEFERRED';
      reason='a release is already active';
    }else if(!project.stale){
      state='CURRENT';
    }else if(!project.cooldownReady){
      state='DEFERRED';
      reason='project cooldown is still active';
    }else if(project.mode==='workflow-dispatch'&&!project.certificationReady){
      state='DEFERRED';
      reason=project.backlogReason||'current main SHA has not completed exact-main certification';
    }else if(usage>=softCap){
      state='DEFERRED';
      reason='team normal deployment budget is exhausted';
    }else if(!selectedKeys.has(project.key)){
      state='DEFERRED';
      reason=project.budgetState==='OVER_SHARE'
        ? 'project is over its normal share and recovered capacity is reserved for higher-fairness pending work'
        : 'recovered capacity is reserved for a higher-fairness pending project';
    }else{
      state='APPROVED';
      reason=borrowedCapacity
        ? 'borrow unused normal capacity because no under-share pending project needs this slot'
        : project.mode==='workflow-dispatch'
          ? 'dispatch guarded project release workflow'
          : 'deploy latest linked main branch through Vercel Git source';
    }
    return {
      ...project,
      queueRank:rankByKey.get(project.key)||null,
      borrowedCapacity,
      state,
      reason
    };
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
    configuredShares,
    fairnessPolicy:{
      agingPointsPerHour,
      maxAgingPoints,
      underBudgetPointsPerSlot,
      maxUnderBudgetPoints,
      overBudgetPenaltyPerSlot,
      maxBorrowedActionsPerRun
    },
    queue:ranked.map(project=>({
      key:project.key,
      projectName:project.projectName,
      queueRank:rankByKey.get(project.key),
      fairnessScore:project.fairnessScore,
      budgetState:project.budgetState,
      projectUsage24h:project.projectUsage24h,
      normalBudgetShare:project.normalBudgetShare
    })),
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
