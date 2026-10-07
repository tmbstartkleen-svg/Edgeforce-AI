'use client';

import {useEffect,useState} from 'react';

type ProjectState={
  key:string;
  projectName:string;
  usage:number;
  ready:number;
  canceled:number;
  error:number;
  active:number;
  latestDeploymentAt:number;
  repoUpdatedAt:number;
  cooldownReady:boolean;
  pending:boolean;
  priority:number;
  normalBudgetShare:number;
  budgetRemaining:number;
  overBudgetBy:number;
  budgetState:'UNDER_SHARE'|'AT_SHARE'|'OVER_SHARE';
  waitHours:number;
  agingScore:number;
  fairnessScore:number;
  queueRank:number|null;
  borrowedCapacity:boolean;
  governorState:'CURRENT'|'ACTIVE'|'APPROVED'|'DEFERRED';
  reason:string;
};

type Snapshot={
  id:number;
  usage:number;
  softCap:number;
  hardCap:number;
  reserveConsumed:number;
  overHardCap:number;
  slotsToRecover:number;
  nextNormalSlotAt?:string|null;
  createdAt:string;
};

type Decision={
  id:number;
  snapshotId:number;
  projectKey:string;
  projectName:string;
  decision:string;
  reason:string;
  pending:boolean;
  active:number;
  cooldownReady:boolean;
  usage:number;
  softCap:number;
  hardCap:number;
  queueRank:number|null;
  fairnessScore:number|null;
  normalBudgetShare:number|null;
  projectUsage24h:number|null;
  budgetState:string|null;
  borrowedCapacity:boolean;
  createdAt:string;
};

type Alert={
  id?:number;
  key?:string;
  alertKey?:string;
  severity:'INFO'|'WATCH'|'ACTION';
  category:string;
  projectKey?:string|null;
  message:string;
  active:boolean;
  firstSeenAt?:string;
  lastSeenAt?:string;
  resolvedAt?:string|null;
};

type RecoveryPoint={
  kind:string;
  label:string;
  at:string;
  recoveredSlots:number;
  projectedUsage:number;
  emergencyAvailable:boolean;
  normalAvailable:boolean;
};

type ReleaseBacklog={
  generatedAt:string;
  liveSha:string|null;
  headSha:string|null;
  requiredWorkflows:string[];
  backlogDepth:number;
  certifiedBacklogDepth:number;
  backlogAgeMinutes:number;
  oldestWaitingAt:string|null;
  newestCertifiedSha:string|null;
  headCertified:boolean;
  truncated:boolean;
  catchUpEligible:boolean;
  reason:string;
};

type BacklogHistory={
  id:number;
  liveSha:string|null;
  headSha:string|null;
  newestCertifiedSha:string|null;
  backlogDepth:number;
  certifiedBacklogDepth:number;
  backlogAgeMinutes:number;
  headCertified:boolean;
  catchUpEligible:boolean;
  truncated:boolean;
  reason:string;
  createdAt:string;
};

type Payload={
  ok:boolean;
  configured:boolean;
  telemetry?:{
    generatedAt:string;
    usage:number;
    softCap:number;
    hardCap:number;
    emergencyReserve:number;
    normalRemaining:number;
    reserveConsumed:number;
    reserveRemaining:number;
    overHardCap:number;
    slotsToRecover:number;
    nextNormalSlotAt:string|null;
    recoveryTimeline:RecoveryPoint[];
    mode:'NORMAL'|'SATURATED'|'EMERGENCY_RESERVE'|'OVER_HARD_CAP';
    projectUsage:Record<string,number>;
    deploymentStates:Record<string,number>;
    projectStates:ProjectState[];
  };
  currentAlerts?:Alert[];
  alerts?:Alert[];
  decisions?:Decision[];
  history?:Snapshot[];
  backlog?:ReleaseBacklog|null;
  backlogError?:string|null;
  backlogHistory?:BacklogHistory[];
  manualControl?:{
    workflow:string;
    url:string;
    publicBrowserReadOnly:boolean;
    normalAvailable:boolean;
    emergencyAvailable:boolean;
    hardBlocked:boolean;
    normalCap:number;
    hardCap:number;
    justificationRequired:boolean;
  };
  error?:string;
};

function time(value:string|null|undefined){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'—':d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function age(ms:number){
  if(!ms)return '—';
  const delta=Math.max(0,Date.now()-ms);
  if(delta<60_000)return '<1m';
  if(delta<3_600_000)return Math.floor(delta/60_000)+'m';
  return (delta/3_600_000).toFixed(1)+'h';
}

export default function VercelGovernorPanel(){
  const [data,setData]=useState<Payload|null>(null);
  useEffect(()=>{
    let on=true;
    const load=()=>fetch('/api/operations/vercel-governor',{cache:'no-store'})
      .then(async response=>({response,json:await response.json() as Payload}))
      .then(({json})=>{if(on)setData(json)})
      .catch(()=>{});
    void load();
    const timer=window.setInterval(load,60_000);
    return()=>{on=false;window.clearInterval(timer)};
  },[]);

  const telemetry=data?.telemetry;
  const projectStates=telemetry?.projectStates||[];
  const activeAlerts=((data?.alerts?.length?data.alerts:data?.currentAlerts)||[]).filter(alert=>alert.active!==false);
  const manual=data?.manualControl;
  return <section className="v21Panel">
    <div className="v21PanelHead">
      <div>
        <div className="eyebrow">V144 VERCEL STANDBY GOVERNOR</div>
        <h3>Cloudflare primary production with Vercel manual disaster-recovery standby and shared-team capacity visibility</h3>
      </div>
      <div className="panelMeta">
        <span>{telemetry?.mode||'UNAVAILABLE'}</span>
        <span>{telemetry?(telemetry.usage+'/'+telemetry.softCap+' normal budget'):'telemetry offline'}</span>
        <span>{telemetry?.generatedAt?time(telemetry.generatedAt):'—'}</span>
      </div>
    </div>

    {!telemetry&&<div className="v21Alert">{data?.error||'Vercel governor telemetry is not available from this runtime.'}</div>}

    {telemetry&&<>
      <div className="v21Stats">
        <div><small>TRAILING 24H</small><strong>{telemetry.usage}</strong><span>team deployments observed</span></div>
        <div><small>NORMAL LIMIT</small><strong>{telemetry.softCap}</strong><span>{telemetry.normalRemaining} normal slots remaining</span></div>
        <div><small>EMERGENCY RESERVE</small><strong>{telemetry.reserveRemaining+'/'+telemetry.emergencyReserve}</strong><span>{telemetry.reserveConsumed} reserve slots consumed</span></div>
        <div><small>OVER HARD CAP</small><strong>{telemetry.overHardCap}</strong><span>hard cap {telemetry.hardCap}</span></div>
        <div><small>SLOTS TO RECOVER</small><strong>{telemetry.slotsToRecover}</strong><span>before a normal release can run</span></div>
        <div><small>NEXT NORMAL SLOT</small><strong>{telemetry.nextNormalSlotAt?time(telemetry.nextNormalSlotAt):'NOW'}</strong><span>{telemetry.nextNormalSlotAt?'predicted from rolling 24h expirations':'normal capacity available'}</span></div>
      </div>

      <div className="historyGrid">
        <div className="historyBox">
          <h4>Certified release backlog</h4>
          {data?.backlog?<><div className="historyRow"><span>Production → main</span><b>{data.backlog.backlogDepth}</b><small>{data.backlog.certifiedBacklogDepth} certified • {data.backlog.backlogAgeMinutes} min oldest wait</small></div>
          <div className="historyRow"><span>Exact main certification</span><b>{data.backlog.headCertified?'CERTIFIED':'WAITING'}</b><small>head {data.backlog.headSha?.slice(0,8)||'unknown'} • live {data.backlog.liveSha?.slice(0,8)||'unknown'}</small></div>
          <div className="historyRow"><span>Newest certified</span><b>{data.backlog.newestCertifiedSha?.slice(0,8)||'NONE'}</b><small>{data.backlog.reason}</small></div>
          <div className="historyRow"><span>Safe catch-up</span><b>{data.backlog.catchUpEligible?'ELIGIBLE':'BLOCKED'}</b><small>{data.backlog.truncated?'compare window truncated • ':''}requires exact head certification plus a V142 normal slot</small></div></>:<div className="historyRow"><span>Backlog telemetry unavailable</span><b>BLOCKED</b><small>{data?.backlogError||'Exact certification state could not be verified.'}</small></div>}
        </div>

        <div className="historyBox">
          <h4>Backlog history</h4>
          {(data?.backlogHistory||[]).slice(0,8).map(row=><div className="historyRow" key={row.id}><span>{time(row.createdAt)}</span><b>{row.backlogDepth}</b><small>{row.certifiedBacklogDepth} certified • age {row.backlogAgeMinutes}m • head {row.headCertified?'certified':'waiting'} • catch-up {row.catchUpEligible?'eligible':'blocked'}</small></div>)}
          {!data?.backlogHistory?.length&&<div className="historyRow"><span>No backlog snapshots yet</span><b>—</b><small>V143 will persist release-lag evidence every 15 minutes.</small></div>}
        </div>
      </div>

      <div className="historyGrid">
        <div className="historyBox">
          <h4>Active recovery alerts</h4>
          {activeAlerts.slice(0,8).map(alert=><div className="historyRow" key={alert.alertKey||alert.key||alert.message}>
            <span>{alert.category}{alert.projectKey?' • '+alert.projectKey:''}</span>
            <b>{alert.severity}</b>
            <small>{alert.message}</small>
          </div>)}
          {!activeAlerts.length&&<div className="historyRow"><span>No active governor alert</span><b>READY</b><small>No current capacity or project-state warning is recorded.</small></div>}
        </div>

        <div className="historyBox">
          <h4>Recovery timeline</h4>
          {(telemetry.recoveryTimeline||[]).map(point=><div className="historyRow" key={point.kind+'-'+point.at}>
            <span>{point.label}</span>
            <b>{time(point.at)}</b>
            <small>{point.recoveredSlots} expired • projected usage {point.projectedUsage}{point.normalAvailable?' • NORMAL OPEN':point.emergencyAvailable?' • EMERGENCY RESERVE':''}</small>
          </div>)}
          {!telemetry.recoveryTimeline?.length&&<div className="historyRow"><span>No recovery wait</span><b>NOW</b><small>Normal governed capacity is currently available.</small></div>}
        </div>

        <div className="historyBox">
          <h4>Reviewed manual release control</h4>
          <div className="historyRow"><span>Normal release</span><b>{manual?.normalAvailable?'AVAILABLE':'BLOCKED'}</b><small>allowed only below {manual?.normalCap??telemetry.softCap}</small></div>
          <div className="historyRow"><span>Emergency reserve</span><b>{manual?.emergencyAvailable?'AVAILABLE':'BLOCKED'}</b><small>reviewed workflow only; never at or above {manual?.hardCap??telemetry.hardCap}</small></div>
          <div className="historyRow"><span>Hard-cap bypass</span><b>NEVER</b><small>project, tier, and written justification are required in GitHub Actions</small></div>
          {manual?.url&&<a className="ackBtn" href={manual.url} target="_blank" rel="noreferrer">OPEN REVIEWED MANUAL RELEASE</a>}
        </div>
      </div>

      <div className="tableWrap">
        <table>
          <thead><tr><th>Project</th><th>Queue</th><th>Score</th><th>Budget</th><th>Governor</th><th>24h Usage</th><th>Active</th><th>Last Deploy</th><th>Reason</th></tr></thead>
          <tbody>
            {projectStates.map(project=><tr key={project.key}>
              <td><b>{project.projectName}</b></td>
              <td>{project.queueRank?'#'+project.queueRank:'—'}</td>
              <td>{project.fairnessScore.toFixed(0)}</td>
              <td>{project.usage+'/'+project.normalBudgetShare}<br/><small>{project.budgetState}{project.borrowedCapacity?' • BORROWED':''}</small></td>
              <td><span className={'grade '+(project.governorState==='CURRENT'?'elite':project.governorState==='APPROVED'?'strong':project.governorState==='ACTIVE'?'watch':'pass')}>{project.governorState}</span></td>
              <td>{project.usage}</td>
              <td>{project.active}</td>
              <td>{age(project.latestDeploymentAt)}</td>
              <td>{project.reason}</td>
            </tr>)}
            {!projectStates.length&&<tr><td colSpan={9} className="emptyRow">No governed project telemetry is available.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="historyGrid">
        <div className="historyBox">
          <h4>Deployment accounting</h4>
          {Object.entries(telemetry.projectUsage).sort((a,b)=>b[1]-a[1]).map(([name,count])=><div className="historyRow" key={name}><span>{name}</span><b>{count}</b><small>deployments in the rolling window</small></div>)}
        </div>
        <div className="historyBox">
          <h4>Governor decision history</h4>
          {(data?.decisions||[]).slice(0,10).map(row=><div className="historyRow" key={row.id}><span>{row.projectName}{row.queueRank?' • #'+row.queueRank:''}</span><b>{row.decision}</b><small>{time(row.createdAt)} • score {row.fairnessScore??'—'} • share {row.projectUsage24h??'—'}/{row.normalBudgetShare??'—'} • {row.budgetState||'—'}{row.borrowedCapacity?' • BORROWED':''} • {row.reason}</small></div>)}
          {!data?.decisions?.length&&<div className="historyRow"><span>No decision records yet</span><b>—</b><small>New v117 snapshots will persist queue rank, score, share usage, and allocation state.</small></div>}
        </div>
        <div className="historyBox">
          <h4>Governor history</h4>
          {(data?.history||[]).slice(0,8).map(row=><div className="historyRow" key={row.id}><span>{time(row.createdAt)}</span><b>{row.usage+'/'+row.softCap}</b><small>{row.slotsToRecover} slot(s) to recover • reserve {row.reserveConsumed} • over hard cap {row.overHardCap}</small></div>)}
          {!data?.history?.length&&<div className="historyRow"><span>No snapshots yet</span><b>—</b><small>The first live telemetry read will seed durable history.</small></div>}
        </div>
      </div>
    </>}
  </section>;
}
